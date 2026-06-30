from bson import ObjectId
from flask import Flask, request, jsonify
from flask_cors import CORS
from crewai import Task , Crew , Process
from comparison_tool import LANG_CONFIG, run_comparison
import os
import json
from dotenv import load_dotenv
from pymongo import MongoClient
import random
import string
import smtplib
from datetime import datetime, timedelta
import re

import uuid
from ai_core import AICore
from interview_engine import InterviewEngine
from roadmap_agent import generate_roadmap as _gen_roadmap, refresh_roadmap as _refresh_roadmap
from quiz_agent import analyze_quiz as _analyze_quiz
from cv_analyzer import analyze_cv as _analyze_cv
from pymongo import MongoClient as _MC
import tempfile

load_dotenv()

# Instantiate the educational chatbot assistant
ai_core = AICore()

# Instantiate the track-discovery interview engine (loads VS on startup)
interview_engine = InterviewEngine()
app = Flask(__name__)

# CORS — restrict to the deployed frontend origin(s) when provided.
# Set FRONTEND_ORIGIN in the backend env, e.g. "https://edupick.vercel.app"
# (comma-separated for multiple). Defaults to "*" for local dev.
_origins = os.getenv("FRONTEND_ORIGIN", "*")
_origins = [o.strip() for o in _origins.split(",")] if _origins != "*" else "*"
CORS(app, resources={r"/*": {"origins": _origins}})

# MongoDB — use MONGO_URL (e.g. a free MongoDB Atlas connection string),
# falling back to a local instance for development.
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
DB_NAME   = os.getenv("MONGO_DB", "graduation_project")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]
users_collection=db["users"]
data_collection=db["data_collection"]
roadmap_collection=db["roadmap_collection"]
quiz_collection=db["quiz_results"]
topic_quiz_collection=db["topic_quiz_results"]
interview_collection=db["interview_results"]
chat_log_collection=db["chat_logs"]
careers_collection=db["careers"]
cv_collection=db["cv_analyses"]
print(f"Connected to MongoDB ({DB_NAME})")

# Home
@app.route("/")
def home():
    return jsonify({"message": "Backend running successfully 🚀"})

# Signup
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    print("Signup data:", data)
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    confirmPassword = data.get("confirmPassword")

    # ── Profile fields (used to personalize interview / roadmap) ──
    age          = data.get("age")
    status       = (data.get("status") or "").strip()         # "student" | "graduate"
    study_level  = (data.get("study_level") or "").strip()    # "high_school" | "college" (only if student)

    if not all([name , email , password , confirmPassword]):
        return jsonify({"error": "All fields are required"}), 400

    if (password != confirmPassword):
        return jsonify({"error":"passwords not match "}),400

    if status not in ("student", "graduate"):
        return jsonify({"error": "Please select whether you are a student or a graduate"}), 400

    if status == "student" and study_level not in ("high_school", "college"):
        return jsonify({"error": "Please select your study level (high school or college)"}), 400

    if users_collection.find_one({"email":email}):
       return jsonify({"error":"Email already exist"})

    try:
        age_val = int(age) if age not in (None, "") else None
    except (ValueError, TypeError):
        age_val = None

    # path_type drives the interview flow:
    #   high-school student → choose college + track; everyone else → track only
    default_path_type = "college_and_track" if (status == "student" and study_level == "high_school") else "track_only"

    users_collection.insert_one({
        "name": name,
        "email": email,
        "password": password,
        "age": age_val,
        "status": status,
        "study_level": study_level if status == "student" else None,
        "default_path_type": default_path_type,
        "created_at": datetime.utcnow(),
    })

    return jsonify({"message": "User registered successfully"}), 201

# Login
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user = users_collection.find_one({"email": email})
    if user and user["password"] == password:
        return jsonify({"message": "Login successful", "name": user.get("name", "")}), 200
    else:
        return jsonify({"error": "Invalid email or password"}), 401

def send_email(receiver, subject, body):
    import ssl
    from email.message import EmailMessage

    # Credentials come from the environment (never hardcode secrets):
    #   EMAIL_SENDER   = your@gmail.com
    #   EMAIL_PASSWORD = a Gmail App Password
    sender   = os.getenv("EMAIL_SENDER", "")
    password = os.getenv("EMAIL_PASSWORD", "")
    if not sender or not password:
        raise RuntimeError("EMAIL_SENDER / EMAIL_PASSWORD not configured in environment")

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = receiver
    msg["Subject"] = subject
    msg.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as smtp:
        smtp.login(sender, password)
        smtp.send_message(msg)

@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.json
    email = data.get("email")

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Email not found"}), 404

    code = ''.join(random.choices(string.digits, k=6))
    expiration = datetime.utcnow() + timedelta(minutes=10)

    users_collection.update_one(
        {"email": email},
        {"$set": {"code": code, "expires_at": expiration}},
        upsert=True
    )

    # send email
    send_email(email, "Your Password Reset Code", f"Your verification code is: {code}")

    return jsonify({"message": "Verification code sent to your email"}), 200

# 🔹 Route 2: Verify code
@app.route("/verification", methods=["POST"])
def verification():
    data = request.json
    email = data.get("email")
    code = data.get("code")

    record = users_collection.find_one({"email": email, "code": code})
    if not record:
        return jsonify({"error": "Invalid code"}), 400

    if record["expires_at"] < datetime.utcnow():
        return jsonify({"error": "Code expired"}), 400

    return jsonify({"message": "Code verified"}), 200

# 🔹 Route 3: Reset password
@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.json
    email = data.get("email")
    new_password = data.get("password")

    record = users_collection.find_one({"email": email})
    if not record:
        return jsonify({"error": "Verification required"}), 400

    users_collection.update_one(
        {"email": email},
        {
            "$set": {"password": new_password},
            "$unset": {"code": "", "expires_at": ""} 
        }
    )

    return jsonify({"message": "Password updated successfully"}), 200

@app.route("/dashboard", methods=["GET"])
def dashboard():
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = users_collection.find_one({"email": email}, {"_id": 0})
    if not user:
        return jsonify({"error": "User not found"}), 404

    # ── Quiz stats (topic quizzes + per-phase roadmap quizzes) ─────────────────
    quiz_docs = list(topic_quiz_collection.find(
        {"email": email},
        {"percentage": 1, "test_name": 1, "topic": 1, "source": 1, "submitted_at": 1}
    ).sort("submitted_at", -1))

    quiz_count = len(quiz_docs)
    quiz_avg   = 0
    if quiz_count:
        pcts     = [d.get("percentage", 0) for d in quiz_docs]
        quiz_avg = round(sum(pcts) / quiz_count)

    # ── Roadmap stats ──────────────────────────────────────────────────────────
    roadmap_docs = list(roadmap_collection.find(
        {"email": email},
        {"roadmap_id": 1, "track": 1, "roadmap": 1, "created_at": 1}
    ).sort("created_at", -1))

    total_roadmaps = len(roadmap_docs)
    roadmap_pct    = 0
    done_tasks     = 0
    total_tasks    = 0

    if roadmap_docs:
        phases = roadmap_docs[0].get("roadmap", {}).get("phases", [])
        for phase in phases:
            for task in phase.get("tasks", []):
                total_tasks += 1
                if task.get("completed"):
                    done_tasks += 1
        if total_tasks:
            roadmap_pct = round((done_tasks / total_tasks) * 100)

    # ── Recent activity (quiz + roadmap saves, sorted newest first) ────────────
    activity_items = []
    for d in quiz_docs[:5]:
        name = d.get("test_name") or d.get("topic", "Quiz")
        kind = "roadmap quiz" if d.get("source") == "roadmap" else "topic quiz"
        ts    = d.get("submitted_at")
        date  = ts.strftime("%b %d") if hasattr(ts, "strftime") else ""
        label = f"Took {kind} → {name}" + (f"  ({date})" if date else "")
        activity_items.append((ts or datetime.min, label))

    for rm in roadmap_docs[:5]:
        track = rm.get("track", "Roadmap")
        ts    = rm.get("created_at")
        date  = ts.strftime("%b %d") if hasattr(ts, "strftime") else ""
        label = f"Saved {track} roadmap" + (f"  ({date})" if date else "")
        activity_items.append((ts or datetime.min, label))

    activity_items.sort(key=lambda x: x[0], reverse=True)
    recent_activity = [msg for _, msg in activity_items[:5]]

    # ── Next actionable task (first incomplete task in the latest roadmap) ──────
    next_task   = None
    current_track = ""
    latest_roadmap_id = None
    if roadmap_docs:
        latest = roadmap_docs[0]
        current_track = latest.get("track", "")
        latest_roadmap_id = latest.get("roadmap_id")
        for phase in latest.get("roadmap", {}).get("phases", []):
            for task in phase.get("tasks", []):
                if not task.get("completed"):
                    next_task = task.get("title")
                    break
            if next_task:
                break

    # ── Chat activity over the last 7 days (for bar chart) ─────────────────────
    today = datetime.utcnow().date()
    chat_days = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        start = datetime(day.year, day.month, day.day)
        end   = start + timedelta(days=1)
        count = chat_log_collection.count_documents(
            {"email": email, "at": {"$gte": start, "$lt": end}}
        )
        chat_days.append({"day": day.strftime("%a"), "count": count})

    # ── Cross-feature flags ────────────────────────────────────────────────────
    has_interview = interview_collection.count_documents({"email": email}) > 0
    topic_quiz_count = topic_quiz_collection.count_documents({"email": email})

    return jsonify({
        "username":          user.get("name", "User"),
        "careerChoices":     quiz_count,
        "quizPerformance":   quiz_avg,
        "roadmapCompleted":  done_tasks,
        "totalRoadmaps":     total_roadmaps,
        "activeDays":        min(quiz_count + total_roadmaps, 7),
        "roadmapPercentage": roadmap_pct,
        "roadmapRemaining":  max(total_tasks - done_tasks, 0),
        "recentActivity":    recent_activity,
        "chatDays":          chat_days,
        "nextTask":          next_task,
        "currentTrack":      current_track,
        "latestRoadmapId":   latest_roadmap_id,
        "hasInterview":      has_interview,
        "hasRoadmap":        total_roadmaps > 0,
        "suggestedTrack":    user.get("suggested_track", ""),
        "suggestedTracks":   user.get("suggested_tracks", []),
        "topicQuizCount":    topic_quiz_count,
    }), 200

def _build_chat_context(email: str):
    """Build a context dict for AICore from the user's latest saved roadmap."""
    if not email:
        return None

    ctx = {
        "user_state": {
            "current_level": "beginner",
            "completed_topics": [],
            "struggling_with": [],
        },
        "roadmap_relations": {
            "prerequisites": [],
            "next_topics": [],
            "resources": [],
        },
        "detected_topic": {
            "topic_name": None,
            "topic_id": None,
            "confidence": 0.0,
            "status": "out_of_scope",
        },
        "decision_hint": "explain_concept",
    }

    try:
        rm_doc = roadmap_collection.find_one(
            {"email": email},
            sort=[("created_at", -1)]
        )
        if rm_doc:
            rm    = rm_doc.get("roadmap", {})
            track = rm.get("track", "")
            level = rm.get("level", "beginner")

            ctx["user_state"]["current_level"] = level

            if track:
                ctx["detected_topic"]["topic_name"] = track
                ctx["detected_topic"]["status"]     = "matched"
                ctx["detected_topic"]["confidence"] = 1.0

            completed, next_tasks = [], []
            for phase in rm.get("phases", []):
                for task in phase.get("tasks", []):
                    if task.get("completed"):
                        completed.append(task["title"])
                    elif len(next_tasks) < 3:
                        next_tasks.append(task["title"])

            ctx["user_state"]["completed_topics"]    = completed[:10]
            ctx["roadmap_relations"]["next_topics"]  = next_tasks
    except Exception as exc:
        print(f"[Chat] context build error: {exc}")

    return ctx


@app.route("/chatbot/context", methods=["GET"])
def chatbot_context():
    """Return roadmap progress summary for the sidebar panel."""
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"context": None}), 200

    try:
        rm_doc = roadmap_collection.find_one(
            {"email": email},
            sort=[("created_at", -1)]
        )
        if not rm_doc:
            return jsonify({"context": None}), 200

        rm     = rm_doc.get("roadmap", {})
        phases = rm.get("phases", [])

        total_tasks = sum(len(p.get("tasks", [])) for p in phases)
        done_tasks  = sum(1 for p in phases for t in p.get("tasks", []) if t.get("completed"))
        progress    = round((done_tasks / total_tasks * 100) if total_tasks else 0)

        current_task = next_task = None
        for phase in phases:
            for task in phase.get("tasks", []):
                if not task.get("completed"):
                    if current_task is None:
                        current_task = task["title"]
                    elif next_task is None:
                        next_task = task["title"]

        return jsonify({
            "context": {
                "track":        rm.get("track", ""),
                "level":        rm.get("level", "beginner"),
                "progress_pct": progress,
                "current_task": current_task or "All tasks completed!",
                "next_task":    next_task or "—",
                "total_tasks":  total_tasks,
                "done_tasks":   done_tasks,
            }
        }), 200
    except Exception as exc:
        print(f"[Chat] context route error: {exc}")
        return jsonify({"context": None}), 200


@app.route("/chatbot", methods=["POST"])
def chat():
    data         = request.get_json() or {}
    user_message = data.get("message", "")
    email        = (data.get("email") or "").strip()
    # history: [{role: "user"|"assistant", content: "..."}]  — last N turns
    history      = data.get("history", [])

    if not user_message.strip():
        return jsonify({"error": "message is required"}), 400

    context = _build_chat_context(email)

    # Log chat activity (for the dashboard chat-days chart)
    if email:
        try:
            chat_log_collection.insert_one({"email": email, "at": datetime.utcnow()})
        except Exception as exc:
            print(f"[Chat] log error: {exc}")

    try:
        result = ai_core.generate_response(user_message, context=context, history=history)
        return jsonify(result), 200
    except Exception as e:
        print("Chatbot error:", e)
        return jsonify({"error": "Failed to get chatbot response"}), 500
 

# ══════════════════════════════════════════════════════════════
# Roadmap routes (Phase 3 — CrewAI + Pydantic)
# ══════════════════════════════════════════════════════════════

@app.route("/roadmap", methods=["POST"])
def roadmap_generate():
    data  = request.get_json() or {}
    track = (data.get("track") or "").strip()
    level = (data.get("level") or "beginner").strip()
    goal  = (data.get("goal") or "").strip()

    if not track:
        return jsonify({"error": "track is required"}), 400
    if not goal:
        return jsonify({"error": "goal is required"}), 400

    try:
        result = _gen_roadmap(track=track, level=level, goal=goal)
        return jsonify({"roadmap": result.model_dump()}), 200
    except Exception as e:
        print("Roadmap error:", e)
        return jsonify({"error": "Failed to generate roadmap"}), 500


@app.route("/roadmap/regenerate", methods=["POST"])
def roadmap_regenerate():
    data  = request.get_json() or {}
    track = (data.get("track") or "").strip()
    level = (data.get("level") or "beginner").strip()
    goal  = (data.get("goal") or "").strip()

    if not track:
        return jsonify({"error": "track is required"}), 400

    try:
        result = _gen_roadmap(track=track, level=level, goal=goal)
        return jsonify({"roadmap": result.model_dump()}), 200
    except Exception as e:
        print("Regenerate error:", e)
        return jsonify({"error": "Failed to regenerate roadmap"}), 500


@app.route("/roadmap/regenerate-with-note", methods=["POST"])
def roadmap_regenerate_with_note():
    data  = request.get_json() or {}
    track = (data.get("track") or "").strip()
    level = (data.get("level") or "beginner").strip()
    goal  = (data.get("goal") or "").strip()
    note  = (data.get("note") or "").strip()

    if not track:
        return jsonify({"error": "track is required"}), 400

    try:
        result = _gen_roadmap(track=track, level=level, goal=goal, note=note)
        return jsonify({"roadmap": result.model_dump()}), 200
    except Exception as e:
        print("Regenerate-with-note error:", e)
        return jsonify({"error": "Failed to regenerate roadmap"}), 500


@app.route("/roadmap/save", methods=["POST"])
def roadmap_save():
    data         = request.get_json() or {}
    email        = (data.get("email") or "").strip()
    roadmap_data = data.get("roadmap")

    if not email or not roadmap_data:
        return jsonify({"error": "email and roadmap are required"}), 400

    roadmap_id = str(uuid.uuid4())
    roadmap_data["roadmap_id"] = roadmap_id

    roadmap_collection.insert_one({
        "roadmap_id":          roadmap_id,
        "email":               email,
        "track":               roadmap_data.get("track", ""),
        "level":               roadmap_data.get("level", ""),
        "goal":                roadmap_data.get("goal", ""),
        "roadmap":             roadmap_data,
        "created_at":          datetime.utcnow(),
        "last_updated":        datetime.utcnow(),
        "update_interval_days": 30,
    })
    return jsonify({"saved_id": roadmap_id, "message": "Roadmap saved"}), 200


@app.route("/roadmap/user", methods=["GET"])
def roadmap_user():
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"error": "email is required"}), 400

    docs = list(
        roadmap_collection.find(
            {"email": email},
            {"_id": 0, "roadmap_id": 1, "track": 1, "created_at": 1,
             "last_updated": 1, "roadmap": 1}
        ).sort("created_at", -1).limit(20)
    )

    summaries = []
    for doc in docs:
        rm = doc.get("roadmap", {})
        phases      = rm.get("phases", [])
        total_tasks = sum(len(p.get("tasks", [])) for p in phases)
        done_tasks  = sum(
            1 for p in phases for t in p.get("tasks", []) if t.get("completed")
        )
        progress = round((done_tasks / total_tasks * 100) if total_tasks else 0)
        created  = doc.get("created_at")
        updated  = doc.get("last_updated")
        summaries.append({
            "roadmap_id":   doc["roadmap_id"],
            "track":        doc.get("track", ""),
            "created_at":   created.isoformat() if hasattr(created, "isoformat") else str(created),
            "last_updated": updated.isoformat() if hasattr(updated, "isoformat") else str(updated),
            "phases_count": len(phases),
            "progress_pct": progress,
        })

    return jsonify({"roadmaps": summaries}), 200


@app.route("/roadmap/get", methods=["GET"])
def roadmap_get():
    """Fetch a single saved roadmap by id (to open it for viewing/editing)."""
    roadmap_id = (request.args.get("roadmap_id") or "").strip()
    email      = (request.args.get("email") or "").strip()
    if not roadmap_id:
        return jsonify({"error": "roadmap_id is required"}), 400

    query = {"roadmap_id": roadmap_id}
    if email:
        query["email"] = email

    doc = roadmap_collection.find_one(query, {"_id": 0})
    if not doc:
        return jsonify({"error": "Roadmap not found"}), 404

    rm = doc.get("roadmap", {})
    # Make sure the embedded roadmap carries its id + meta for the editor
    rm["roadmap_id"] = doc.get("roadmap_id")
    rm.setdefault("track", doc.get("track", ""))
    rm.setdefault("level", doc.get("level", ""))
    rm.setdefault("goal",  doc.get("goal", ""))
    return jsonify({"roadmap": rm}), 200


@app.route("/roadmap/progress", methods=["POST"])
def roadmap_progress():
    data           = request.get_json() or {}
    email          = (data.get("email") or "").strip()
    roadmap_id     = (data.get("roadmap_id") or "").strip()
    updated_roadmap = data.get("roadmap")

    if not email or not roadmap_id or not updated_roadmap:
        return jsonify({"error": "email, roadmap_id, and roadmap are required"}), 400

    res = roadmap_collection.update_one(
        {"roadmap_id": roadmap_id, "email": email},
        {"$set": {"roadmap": updated_roadmap, "last_updated": datetime.utcnow()}}
    )

    if res.matched_count == 0:
        return jsonify({"error": "Roadmap not found"}), 404
    return jsonify({"message": "Progress saved"}), 200


@app.route("/roadmap/refresh", methods=["POST"])
def roadmap_refresh():
    data       = request.get_json() or {}
    email      = (data.get("email") or "").strip()
    roadmap_id = (data.get("roadmap_id") or "").strip()

    if not email or not roadmap_id:
        return jsonify({"error": "email and roadmap_id are required"}), 400

    stored = roadmap_collection.find_one({"roadmap_id": roadmap_id, "email": email})
    if not stored:
        return jsonify({"error": "Roadmap not found"}), 404

    try:
        new_roadmap = _refresh_roadmap(
            stored_roadmap=stored["roadmap"],
            track=stored.get("track", ""),
            level=stored.get("level", "beginner"),
            goal=stored.get("goal", ""),
        )
        new_dict = new_roadmap.model_dump()
        new_dict["roadmap_id"] = roadmap_id

        roadmap_collection.update_one(
            {"roadmap_id": roadmap_id},
            {"$set": {"roadmap": new_dict, "last_updated": datetime.utcnow()}}
        )
        return jsonify({"roadmap": new_dict}), 200
    except Exception as e:
        print("Refresh error:", e)
        return jsonify({"error": "Failed to refresh roadmap"}), 500

# ══════════════════════════════════════════════════════════════
# CV Analyzer
# ══════════════════════════════════════════════════════════════

@app.route("/cv/analyze", methods=["POST"])
def cv_analyze():
    """Analyze an uploaded CV (PDF) against a target job title.

    Multipart form: cv (file, PDF), job_title (str), email (optional).
    Returns the report at the top level.
    """
    job_title = (request.form.get("job_title") or "").strip()
    email     = (request.form.get("email") or "").strip()
    cv_file   = request.files.get("cv")

    if not job_title:
        return jsonify({"error": "job_title is required"}), 400
    if cv_file is None or cv_file.filename == "":
        return jsonify({"error": "A CV PDF file is required"}), 400

    fname = (cv_file.filename or "").lower()
    if not fname.endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    tmp_path = None
    try:
        # Save to a temp file so pdfplumber can open it.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            cv_file.save(tmp.name)
            tmp_path = tmp.name

        report = _analyze_cv(tmp_path, job_title)

        # Persist per-user (best-effort).
        if email:
            try:
                cv_collection.insert_one({
                    "email":       email,
                    "job_title":   job_title,
                    "report":      report,
                    "created_at":  datetime.utcnow(),
                })
            except Exception as exc:
                print("CV save error:", exc)

        return jsonify(report), 200
    except Exception as e:
        print("CV analyze error:", e)
        return jsonify({"error": "Failed to analyze CV", "details": str(e)}), 500
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@app.route("/cv/history", methods=["GET"])
def cv_history():
    """Return a user's previous CV analyses (newest first)."""
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"error": "email is required"}), 400

    docs = list(cv_collection.find(
        {"email": email},
        {"_id": 0, "job_title": 1, "created_at": 1, "report": 1}
    ).sort("created_at", -1).limit(20))

    items = []
    for d in docs:
        rep = d.get("report", {})
        ts  = d.get("created_at")
        items.append({
            "job_title":     d.get("job_title", ""),
            "created_at":    ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
            "match_score":   rep.get("match_score"),
            "ats_score":     rep.get("ats_score"),
            "content_score": rep.get("content_score"),
            "verdict":       rep.get("verdict"),
        })
    return jsonify({"analyses": items}), 200


# =====================
# Track Discovery Interview  (Phase 2)
# =====================

@app.route("/interview/start", methods=["POST"])
def interview_start():
    """
    Start a new interview session.
    Body: { user_name?, path_type?, email? }
    If email is given, name / path_type / profile are auto-loaded from the account.
    Returns: { session_id, question, question_number, total_questions }
    """
    data = request.get_json() or {}
    email     = (data.get("email") or "").strip()
    user_name = (data.get("user_name") or "").strip()
    path_type = data.get("path_type")
    profile   = {}

    # Auto-load the user's profile from the account
    if email:
        user = users_collection.find_one({"email": email})
        if user:
            user_name = user_name or user.get("name", "")
            path_type = path_type or user.get("default_path_type")
            profile = {
                "age":         user.get("age"),
                "status":      user.get("status"),
                "study_level": user.get("study_level"),
            }

    path_type = path_type or "track_only"

    if not user_name:
        return jsonify({"error": "user_name is required"}), 400
    if path_type not in ("track_only", "college_and_track"):
        return jsonify({"error": "path_type must be 'track_only' or 'college_and_track'"}), 400

    result = interview_engine.start_session(user_name, path_type, email, profile=profile)
    return jsonify(result), 200


@app.route("/interview/answer", methods=["POST"])
def interview_answer():
    """
    Submit an answer to the current question.
    Body: { session_id, answer }
    Returns:
        - If more questions: { done:false, question, question_number, total_questions }
        - If done:           { done:true, result: { report, suggested_track, ... } }
    """
    data       = request.get_json()
    session_id = data.get("session_id")
    answer     = (data.get("answer") or "").strip()

    if not session_id or not answer:
        return jsonify({"error": "session_id and answer are required"}), 400

    result = interview_engine.answer(session_id, answer)

    if result.get("error"):
        return jsonify(result), 404

    # If session completed, persist the full interview + suggestions
    if result.get("done") and result.get("result"):
        res              = result["result"]
        email            = res.get("email") or data.get("email")
        suggested_track  = res.get("suggested_track")
        suggested_tracks = res.get("suggested_tracks", [])
        suggested_colleges = res.get("suggested_colleges", [])

        if email:
            interview_collection.insert_one({
                "email":              email,
                "user_name":          res.get("user_name"),
                "path_type":          res.get("path_type"),
                "report":             res.get("report"),
                "answers":            res.get("answers", []),
                "suggested_track":    suggested_track,
                "suggested_tracks":   suggested_tracks,
                "suggested_colleges": suggested_colleges,
                "track_keywords":     res.get("track_keywords"),
                "college_results":    res.get("college_results", []),
                "submitted_at":       datetime.utcnow(),
            })
            update = {}
            if suggested_track:
                update["suggested_track"] = suggested_track
            if suggested_tracks:
                update["suggested_tracks"] = suggested_tracks
            if suggested_colleges:
                update["suggested_colleges"] = suggested_colleges
            if update:
                users_collection.update_one({"email": email}, {"$set": update})

    return jsonify(result), 200


@app.route("/interview/result/<session_id>", methods=["GET"])
def interview_result(session_id):
    """Retrieve the final result for a completed session."""
    result = interview_engine.get_result(session_id)
    if result is None:
        return jsonify({"error": "Result not ready or session not found"}), 404
    return jsonify(result), 200


@app.route("/interview/latest", methods=["GET"])
def interview_latest():
    """Latest stored interview for a user — used for cross-feature suggestions."""
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"has_interview": False}), 200

    doc = interview_collection.find_one(
        {"email": email}, {"_id": 0}, sort=[("submitted_at", -1)]
    )
    if not doc:
        return jsonify({"has_interview": False, "suggested_tracks": []}), 200

    ts = doc.get("submitted_at")
    return jsonify({
        "has_interview":    True,
        "suggested_track":  doc.get("suggested_track"),
        "suggested_tracks": doc.get("suggested_tracks", []),
        "path_type":        doc.get("path_type"),
        "submitted_at":     ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
    }), 200


@app.route("/profile", methods=["GET"])
def profile():
    """Aggregated profile: account info + roadmaps + quiz results + interview."""
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"error": "email is required"}), 400

    user = users_collection.find_one({"email": email}, {"_id": 0, "password": 0})
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Roadmaps (summaries)
    roadmap_docs = list(roadmap_collection.find(
        {"email": email}, {"_id": 0, "roadmap_id": 1, "track": 1, "level": 1,
                            "roadmap": 1, "created_at": 1}
    ).sort("created_at", -1).limit(20))
    roadmaps = []
    for doc in roadmap_docs:
        rm = doc.get("roadmap", {})
        phases = rm.get("phases", [])
        total = sum(len(p.get("tasks", [])) for p in phases)
        done  = sum(1 for p in phases for t in p.get("tasks", []) if t.get("completed"))
        created = doc.get("created_at")
        roadmaps.append({
            "roadmap_id":   doc.get("roadmap_id"),
            "track":        doc.get("track", ""),
            "level":        doc.get("level", ""),
            "progress_pct": round((done / total * 100) if total else 0),
            "created_at":   created.isoformat() if hasattr(created, "isoformat") else str(created),
        })

    # Career quiz results
    quiz_docs = list(quiz_collection.find(
        {"email": email}, {"_id": 0, "result.top_track": 1, "result.match_pct": 1, "submitted_at": 1}
    ).sort("submitted_at", -1).limit(20))
    quizzes = []
    for d in quiz_docs:
        ts = d.get("submitted_at")
        quizzes.append({
            "top_track": d.get("result", {}).get("top_track", ""),
            "match_pct": d.get("result", {}).get("match_pct", 0),
            "submitted_at": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
        })

    # Topic quizzes
    topic_docs = list(topic_quiz_collection.find(
        {"email": email}, {"_id": 0}
    ).sort("submitted_at", -1).limit(20))
    for d in topic_docs:
        ts = d.get("submitted_at")
        d["submitted_at"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)

    # Latest interview
    interview = interview_collection.find_one(
        {"email": email},
        {"_id": 0, "report": 1, "suggested_track": 1, "suggested_tracks": 1,
         "suggested_colleges": 1, "path_type": 1, "answers": 1, "submitted_at": 1},
        sort=[("submitted_at", -1)],
    )
    if interview:
        ts = interview.get("submitted_at")
        interview["submitted_at"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)

    return jsonify({
        "name":            user.get("name", ""),
        "email":           user.get("email", ""),
        "age":             user.get("age"),
        "status":          user.get("status"),
        "study_level":     user.get("study_level"),
        "suggested_track": user.get("suggested_track", ""),
        "suggested_tracks": user.get("suggested_tracks", []),
        "suggested_colleges": user.get("suggested_colleges", []),
        "roadmaps":        roadmaps,
        "quizzes":         quizzes,
        "topic_quizzes":   topic_docs,
        "interview":       interview,
    }), 200


@app.route("/compare", methods=["POST"])
def compare():
    try:
        data = request.json
        lang          = data.get("lang", "en")
        tracks        = data.get("tracks", "")
        location      = data.get("location", "Global")
        currency      = data.get("currency", "USD")
        year          = data.get("year", "2026")
        criteria_nums = data.get("criteria", "1,2,3,4,5,6,7")

        if not tracks:
            return jsonify({"error": "tracks field is required"}), 400

        cfg = LANG_CONFIG.get(lang, LANG_CONFIG['en'])
        criteria = ", ".join([
            cfg['criteria'][n.strip()]
            for n in criteria_nums.split(",")
            if n.strip() in cfg['criteria']
        ])

        raw = run_comparison(tracks, location, currency, year, criteria, lang)
        return jsonify({"result": raw}), 200

    except Exception as e:
        print("Comparison error:", e)
        return jsonify({"error": "Failed to run comparison"}), 500



# ══════════════════════════════════════════════════════════════
# Quiz routes (Phase 5)
# ══════════════════════════════════════════════════════════════

@app.route("/quiz/submit", methods=["POST"])
def quiz_submit():
    data    = request.get_json() or {}
    answers = data.get("answers", {})
    email   = (data.get("email") or "").strip()

    if not answers:
        return jsonify({"error": "answers are required"}), 400

    try:
        result = _analyze_quiz(answers)
    except Exception as e:
        print("Quiz analysis error:", e)
        return jsonify({"error": "Failed to analyze quiz"}), 500

    if email:
        quiz_collection.insert_one({
            "email":        email,
            "answers":      answers,
            "result":       result,
            "submitted_at": datetime.utcnow(),
        })

        users_collection.update_one(
            {"email": email},
            {"$set": {"lastQuizTrack": result["top_track"]}},
        )

    return jsonify(result), 200


@app.route("/quiz/results", methods=["GET"])
def quiz_results():
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"error": "email is required"}), 400

    docs = list(
        quiz_collection.find(
            {"email": email},
            {"_id": 0}
        ).sort("submitted_at", -1).limit(10)
    )

    for doc in docs:
        ts = doc.get("submitted_at")
        doc["submitted_at"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)

    return jsonify({"results": docs}), 200


# ══════════════════════════════════════════════════════════════
# Topic Quiz routes
# ══════════════════════════════════════════════════════════════

@app.route("/topic-quiz/generate", methods=["POST"])
def topic_quiz_generate():
    data  = request.get_json() or {}
    topic = (data.get("topic") or "").strip()
    count = max(5, min(int(data.get("count", 10)), 10))
    lang  = data.get("lang", "en")

    if not topic:
        return jsonify({"error": "topic is required"}), 400

    is_ar = lang == "ar"

    if is_ar:
        prompt_text = (
            f'أنشئ {count} سؤالاً اختيارياً (اختيار من متعدد) عن موضوع: "{topic}"\n\n'
            "القواعد:\n"
            "- كل سؤال له 4 خيارات بالضبط (A و B و C و D)\n"
            "- إجابة صحيحة واحدة فقط لكل سؤال\n"
            "- الأسئلة تعليمية وواضحة، مستوى مبتدئ إلى متوسط\n"
            "- اكتب السؤال والخيارات باللغة العربية\n\n"
            'أرجع JSON صالح فقط بهذا الشكل:\n'
            '{"questions": [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A"}]}'
        )
    else:
        prompt_text = (
            f'Generate {count} multiple-choice questions about: "{topic}"\n\n'
            "Rules:\n"
            "- Each question has exactly 4 options (A, B, C, D)\n"
            "- Only one correct answer per question\n"
            "- Questions should be educational and clear, beginner to intermediate\n\n"
            "Return ONLY valid JSON in this exact format:\n"
            '{"questions": [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A"}]}'
        )

    try:
        from groq import Groq as _Groq
        _g = _Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
        resp = _g.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert educational quiz creator. "
                        "Always return valid JSON only, no extra text."
                    ),
                },
                {"role": "user", "content": prompt_text},
            ],
            temperature=0.5,
            max_tokens=3000,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content.strip()
        parsed = json.loads(raw)
        questions = parsed.get("questions", [])
        if not questions:
            raise ValueError("Empty questions array")
        return jsonify({"questions": questions}), 200
    except Exception as e:
        print(f"Topic quiz generation error: {e}")
        return jsonify({"error": "Failed to generate quiz"}), 500


@app.route("/topic-quiz/save", methods=["POST"])
def topic_quiz_save():
    data      = request.get_json() or {}
    email     = (data.get("email") or "").strip()
    topic     = (data.get("topic") or "").strip()
    score     = int(data.get("score", 0))
    total     = int(data.get("total", 0))
    lang      = data.get("lang", "en")
    test_name = (data.get("name") or topic or "Topic Quiz").strip()
    # source: "topic" (manual/topic quiz) or "roadmap" (per-phase roadmap quiz)
    source    = (data.get("source") or "topic").strip()
    track     = (data.get("track") or "").strip()

    if not email or not topic:
        return jsonify({"error": "email and topic are required"}), 400

    topic_quiz_collection.insert_one({
        "email":        email,
        "topic":        topic,
        "score":        score,
        "total":        total,
        "lang":         lang,
        "test_name":    test_name,
        "source":       source,
        "track":        track,
        "percentage":   round(score / total * 100) if total else 0,
        "submitted_at": datetime.utcnow(),
    })
    return jsonify({"message": "Result saved successfully"}), 200


@app.route("/topic-quiz/results", methods=["GET"])
def topic_quiz_results():
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"error": "email is required"}), 400

    docs = list(
        topic_quiz_collection.find(
            {"email": email},
            {"_id": 0}
        ).sort("submitted_at", -1).limit(30)
    )
    for doc in docs:
        ts = doc.get("submitted_at")
        doc["submitted_at"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)

    return jsonify({"results": docs}), 200


# Run server
if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False)
