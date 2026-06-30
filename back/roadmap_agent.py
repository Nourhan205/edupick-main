"""
roadmap_agent.py — Phase 3 (v2)

Multi-step, plain-Groq roadmap generator (no CrewAI). Pipeline:
  1. Profile Analyzer   — clean the raw {track, level, goal} into a structured profile
  2. Skill-Gap Mapper   — what to prioritise / skip for this learner
  3. Roadmap Architect  — >=5 phases, each with >=4 *topics* (field-appropriate)
  4. Course Curator      — one real platform + course/playlist per topic
                           -> resource links built from PLATFORM_SEARCH_URLS
  5. Quiz Generator      — a 10-question MCQ quiz at the END of each phase,
                           covering that phase's topics
  6. Task Generator      — one hands-on practical project at the END of each phase
  7. Timeline Planner    — realistic phase/total durations

Output is a validated `RoadmapOutput` (never raises — falls back gracefully).

Schema mapping for the existing UI / Mongo:
  * each phase TOPIC is stored as a `RoadmapTask` (title = topic name) so the
    current task rendering, completion toggle, progress %, and Mongo save all
    keep working unchanged.
  * each phase also gets a single `project` (the practical task) and a `quiz`.

Models are read from llms.py (GROQ default) — change the model in ONE place.
"""

import json
import uuid
import urllib.parse
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from llms import groq_client, ROADMAP_MODEL

# ---------------------------------------------------------------------------
# Real platform search URLs (used to build resource links per topic).
# ---------------------------------------------------------------------------
PLATFORM_SEARCH_URLS = {
    "coursera":     "https://www.coursera.org/search?query={q}",
    "udemy":        "https://www.udemy.com/courses/search/?q={q}",
    "freecodecamp": "https://www.freecodecamp.org/news/search/?query={q}",
    "kaggle":       "https://www.kaggle.com/search?q={q}",
    "edx":          "https://www.edx.org/search?q={q}",
    "fast.ai":      "https://www.fast.ai/",
    "leetcode":     "https://leetcode.com/problemset/?search={q}",
    "datacamp":     "https://www.datacamp.com/search?q={q}",
    "youtube":      "https://www.youtube.com/results?search_query={q}",
}

# How each platform should be labelled / typed in the UI.
_PLATFORM_TYPE = {
    "youtube": "video", "coursera": "course", "udemy": "course",
    "edx": "course", "fast.ai": "course", "datacamp": "course",
    "freecodecamp": "article", "kaggle": "practice", "leetcode": "practice",
}


# ══════════════════════════════════════════════════════════════
# Pydantic schema
# ══════════════════════════════════════════════════════════════

class ResourceItem(BaseModel):
    title: str
    url: Optional[str] = None
    type: str = "article"  # "video" | "article" | "course" | "book" | "practice"


class QuizQuestion(BaseModel):
    question: str
    options: Dict[str, str] = Field(default_factory=dict)  # {"A": "...", ...}
    answer: str = "A"
    explanation: str = ""


class RoadmapTask(BaseModel):
    """A learning TOPIC inside a phase (kept named 'task' for UI/Mongo compat)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str
    description: str = ""
    duration: str = ""
    resources: List[ResourceItem] = Field(default_factory=list)
    completed: bool = False


class PhaseProject(BaseModel):
    """The single hands-on practical task at the end of a phase."""
    title: str = ""
    description: str = ""
    deliverable: str = ""
    estimated_hours: int = 0
    completed: bool = False


class RoadmapPhase(BaseModel):
    phase_number: int
    title: str
    description: str = ""
    duration: str = ""
    tasks: List[RoadmapTask] = Field(default_factory=list)         # the topics
    project: Optional[PhaseProject] = None                          # practical task
    quiz: List[QuizQuestion] = Field(default_factory=list)         # 10 MCQs


class RoadmapOutput(BaseModel):
    track: str
    level: str
    goal: str
    total_duration: str = "Self-paced"
    summary: str = ""
    display_hint: str = "timeline"  # "timeline" | "kanban" | "checklist"
    phases: List[RoadmapPhase] = Field(default_factory=list)


# ══════════════════════════════════════════════════════════════
# Constraints
# ══════════════════════════════════════════════════════════════
MIN_PHASES = 5
MIN_TOPICS_PER_PHASE = 4
QUIZ_QUESTIONS = 10

_LEVEL_DESC = {
    "beginner":     "no prior experience in this area",
    "intermediate": "knows the basics, has some hands-on experience",
    "advanced":     "experienced practitioner wanting to deepen expertise",
}


# ══════════════════════════════════════════════════════════════
# Groq JSON helper
# ══════════════════════════════════════════════════════════════

def _call_llm(prompt: str, temperature: float = 0.3, system: str = "") -> dict:
    """Call Groq with JSON mode and parse the response. Returns {} on failure."""
    client = groq_client()
    if client is None:
        return {}
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        resp = client.chat.completions.create(
            model=ROADMAP_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=temperature,
            max_tokens=4000,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:
        print(f"[RoadmapAgent] LLM error: {exc}")
        return {}


# ══════════════════════════════════════════════════════════════
# 1. Profile Analyzer
# ══════════════════════════════════════════════════════════════

def _run_profile_analyzer(track: str, level: str, goal: str) -> dict:
    level_desc = _LEVEL_DESC.get(level.lower(), level)
    data = _call_llm(f"""Extract a structured student profile. Return ONLY valid JSON.

field/track : {track}
level       : {level} — {level_desc}
goal        : {goal}

Return:
{{
  "specialization": "cleaned field name",
  "academic_level": "standardized level ({level})",
  "career_goal": "concise goal statement",
  "implied_skills": ["skill already implied by their level"],
  "timeline_hint": "urgency from goal e.g. 6 months, or 'flexible'"
}}""")
    # Sensible fallback so the rest of the pipeline always has something.
    return {
        "specialization": data.get("specialization") or track,
        "academic_level": data.get("academic_level") or level,
        "career_goal":    data.get("career_goal") or goal,
        "implied_skills": data.get("implied_skills") or [],
        "timeline_hint":  data.get("timeline_hint") or "flexible",
    }


# ══════════════════════════════════════════════════════════════
# 2. Skill-Gap Mapper
# ══════════════════════════════════════════════════════════════

def _run_skill_gap_mapper(profile: dict) -> dict:
    data = _call_llm(f"""Identify skill gaps for this student. Return ONLY valid JSON.

Profile:
{json.dumps(profile, indent=2)}

Return:
{{
  "skills_to_skip": ["already implied by their level"],
  "priority_skills": ["most important to learn first"],
  "nice_to_have": ["optional for their goal"],
  "weakness_areas": ["likely struggles at their level"]
}}""")
    return {
        "skills_to_skip":  data.get("skills_to_skip") or [],
        "priority_skills": data.get("priority_skills") or [],
        "nice_to_have":    data.get("nice_to_have") or [],
        "weakness_areas":  data.get("weakness_areas") or [],
    }


# ══════════════════════════════════════════════════════════════
# 3. Roadmap Architect
# ══════════════════════════════════════════════════════════════

def _run_architect(
    profile: dict, gaps: dict, track: str, level: str, goal: str,
    note: str = "", completed_tasks: Optional[List[str]] = None,
) -> dict:
    completed_note = ""
    if completed_tasks:
        completed_note = (
            "\nThe user already completed these topics — build on them, don't "
            f"repeat them as primary topics: {'; '.join(completed_tasks[:12])}"
        )
    extra_note = f"\nExtra instruction from the user: {note}" if note.strip() else ""

    data = _call_llm(f"""Design a learning roadmap for this student. Return ONLY valid JSON.

Profile: {json.dumps(profile, indent=2)}
Gaps: {json.dumps(gaps, indent=2)}{completed_note}{extra_note}

CRITICAL RULES before you pick any topic:
1. Ground every topic in what a REAL-WORLD curriculum, degree program, or
   certification for "{profile.get('career_goal', goal)}" in the field of
   "{profile.get('specialization', track)}" actually contains. If an accredited
   program or licensing body for this exact career would NOT include a topic,
   do not include it.
2. Do NOT add programming/coding/data-science tooling (Python, R, SQL, pandas...)
   UNLESS the specialization itself is a technical/programming/data field. Use
   the field's own standard tools and terminology.
3. Cover the field's actual core pillars first (foundational theory, core
   practice/clinical/professional skills, ethics where relevant, applied practice).
4. Topics must be SPECIFIC and SEARCHABLE on YouTube/Google
   (e.g. "Cognitive Behavioral Therapy techniques", not just "therapy").
5. Align topics to priority_skills; skip skills_to_skip.

STRUCTURE REQUIREMENTS (strict):
- Produce AT LEAST {MIN_PHASES} phases ordered from foundation to launch.
- Each phase MUST have AT LEAST {MIN_TOPICS_PER_PHASE} topics.
- Each topic has its own short description and an individual duration.
- Try to make totalDuration match the timeline_hint ({profile.get('timeline_hint', 'flexible')}).

Return:
{{
  "title": "short roadmap title",
  "summary": "2 personalized sentences about what the learner will achieve",
  "total_duration": "e.g. 10 months",
  "display_hint": "timeline | kanban | checklist",
  "phases": [
    {{
      "title": "phase title",
      "description": "1 sentence on this phase",
      "duration": "e.g. 2 months",
      "topics": [
        {{"name": "specific field-appropriate topic",
          "description": "1 sentence on what to learn",
          "duration": "e.g. 1 week"}}
      ]
    }}
  ]
}}""", temperature=0.4)
    return data


# ══════════════════════════════════════════════════════════════
# 4. Course Curator — real platform links per topic (one LLM call)
# ══════════════════════════════════════════════════════════════

def _run_course_curator(arch: dict, profile: dict) -> dict:
    specialization = profile.get("specialization", "")
    goal = profile.get("career_goal", "")

    overview = [
        {"phase": pi, "topics": [t.get("name", "") for t in p.get("topics", [])]}
        for pi, p in enumerate(arch.get("phases", []))
    ]
    platforms = ", ".join(PLATFORM_SEARCH_URLS.keys())

    suggestion = _call_llm(f"""Suggest ONE real course platform + course NAME for EACH topic below.
Return ONLY valid JSON. Do NOT invent URLs — only platform + course_name.

Specialization: {specialization}
Goal: {goal}

Topics by phase (phase is a 0-based index):
{json.dumps(overview, indent=2)}

Pick the platform that best fits each topic from: {platforms}

Return:
{{
  "course_picks": [
    {{"phase": 0, "topic": "exact topic name",
      "platform": "one of the allowed platforms",
      "course_name": "specific real course or playlist name"}}
  ]
}}""")

    picks = {
        (p.get("phase"), p.get("topic")): p
        for p in suggestion.get("course_picks", [])
    }

    for pi, phase in enumerate(arch.get("phases", [])):
        for topic in phase.get("topics", []):
            name = topic.get("name", "")
            q = urllib.parse.quote_plus(f"{name} {specialization}".strip())
            resources = [{
                "title": f"{name} — video tutorials",
                "url": PLATFORM_SEARCH_URLS["youtube"].format(q=q),
                "type": "video",
            }]
            pick = picks.get((pi, name))
            if pick:
                platform = (pick.get("platform") or "coursera").lower().strip()
                course_name = pick.get("course_name") or name
                tmpl = PLATFORM_SEARCH_URLS.get(platform, PLATFORM_SEARCH_URLS["coursera"])
                cq = urllib.parse.quote_plus(course_name)
                resources.append({
                    "title": f"{course_name} ({platform})",
                    "url": tmpl.format(q=cq),
                    "type": _PLATFORM_TYPE.get(platform, "course"),
                })
            else:
                # Fallback: a generic course search so every topic has 2 links.
                resources.append({
                    "title": f"{name} — courses",
                    "url": PLATFORM_SEARCH_URLS["coursera"].format(q=q),
                    "type": "course",
                })
            topic["resources"] = resources
    return arch


# ══════════════════════════════════════════════════════════════
# 5. Quiz Generator — 10 MCQs at the end of each phase
# ══════════════════════════════════════════════════════════════

def _run_quiz_generator(arch: dict, profile: dict) -> dict:
    specialization = profile.get("specialization", "")
    for phase in arch.get("phases", []):
        topics = ", ".join(t.get("name", "") for t in phase.get("topics", []))[:600]
        title = phase.get("title", "")
        data = _call_llm(f"""Create a quiz to test understanding AFTER completing the phase
"{title}" in the field "{specialization}". Cover these topics: {topics}.
Return ONLY valid JSON.

Generate EXACTLY {QUIZ_QUESTIONS} multiple-choice questions, increasing in difficulty.
Each question has 4 options (keys A, B, C, D) and exactly one correct answer.

Return:
{{
  "questions": [
    {{"question": "...",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "answer": "A",
      "explanation": "one sentence why"}}
  ]
}}""", temperature=0.5)
        phase["quiz"] = (data.get("questions") or [])[:QUIZ_QUESTIONS]
    return arch


# ══════════════════════════════════════════════════════════════
# 6. Task Generator — one practical project per phase (one LLM call)
# ══════════════════════════════════════════════════════════════

def _run_task_generator(arch: dict, profile: dict) -> dict:
    specialization = profile.get("specialization", "")
    goal = profile.get("career_goal", "")
    overview = [
        {"phase": pi, "title": p.get("title", ""),
         "topics": [t.get("name", "") for t in p.get("topics", [])]}
        for pi, p in enumerate(arch.get("phases", []))
    ]
    data = _call_llm(f"""For EACH phase below, create ONE hands-on practical task/project that
applies the phase's topics. Return ONLY valid JSON.

Field: {specialization}
Career goal: {goal}
Phases (phase is a 0-based index):
{json.dumps(overview, indent=2)}

Return:
{{
  "tasks": [
    {{"phase": 0,
      "title": "short task title",
      "description": "2-3 sentences on what to build/do",
      "deliverable": "what the student should produce",
      "estimated_hours": 6}}
  ]
}}""", temperature=0.4)

    by_phase = {t.get("phase"): t for t in data.get("tasks", [])}
    for pi, phase in enumerate(arch.get("phases", [])):
        t = by_phase.get(pi)
        if t:
            try:
                hrs = int(t.get("estimated_hours") or 0)
            except (ValueError, TypeError):
                hrs = 0
            phase["project"] = {
                "title": t.get("title", ""),
                "description": t.get("description", ""),
                "deliverable": t.get("deliverable", ""),
                "estimated_hours": hrs,
                "completed": False,
            }
    return arch


# ══════════════════════════════════════════════════════════════
# 7. Timeline Planner — realistic durations
# ══════════════════════════════════════════════════════════════

def _run_timeline_planner(arch: dict, profile: dict) -> dict:
    light = {
        "total_duration": arch.get("total_duration"),
        "phases": [
            {"phase": pi, "title": p.get("title"),
             "duration": p.get("duration"), "topic_count": len(p.get("topics", []))}
            for pi, p in enumerate(arch.get("phases", []))
        ],
    }
    data = _call_llm(f"""Validate and adjust roadmap phase durations. Return ONLY valid JSON.

Level: {profile.get('academic_level')}
Timeline hint: {profile.get('timeline_hint', 'flexible')}
Roadmap overview: {json.dumps(light, indent=2)}

Assume 10-15 study hours/week. Make each phase's duration realistic for its topic_count.
Return:
{{
  "total_duration": "e.g. 10 months",
  "phase_durations": [{{"phase": 0, "duration": "e.g. 2 months"}}]
}}""", temperature=0.2)

    if data.get("total_duration"):
        arch["total_duration"] = data["total_duration"]
    by_phase = {d.get("phase"): d.get("duration") for d in data.get("phase_durations", [])}
    for pi, phase in enumerate(arch.get("phases", [])):
        if by_phase.get(pi):
            phase["duration"] = by_phase[pi]
    return arch


# ══════════════════════════════════════════════════════════════
# Assemble + validate
# ══════════════════════════════════════════════════════════════

def _to_output(arch: dict, track: str, level: str, goal: str) -> RoadmapOutput:
    phases: List[RoadmapPhase] = []
    for pi, p in enumerate(arch.get("phases", []), 1):
        tasks = []
        for ti, topic in enumerate(p.get("topics", []), 1):
            tasks.append(RoadmapTask(
                id=f"p{pi}t{ti}",
                title=topic.get("name", "") or f"Topic {ti}",
                description=topic.get("description", "") or "",
                duration=topic.get("duration", "") or "",
                resources=[ResourceItem(**r) for r in topic.get("resources", []) if r.get("url")],
            ))
        project = None
        if p.get("project"):
            project = PhaseProject(**p["project"])
        quiz = []
        for q in p.get("quiz", []):
            opts = q.get("options") or {}
            if isinstance(opts, list):  # tolerate ["A) ...", ...] -> dict
                opts = {chr(65 + i): str(o) for i, o in enumerate(opts)}
            quiz.append(QuizQuestion(
                question=q.get("question", ""),
                options={str(k): str(v) for k, v in opts.items()},
                answer=str(q.get("answer") or q.get("correct_answer") or "A").strip()[:1].upper(),
                explanation=q.get("explanation", "") or "",
            ))
        phases.append(RoadmapPhase(
            phase_number=pi,
            title=p.get("title", "") or f"Phase {pi}",
            description=p.get("description", "") or "",
            duration=p.get("duration", "") or "",
            tasks=tasks,
            project=project,
            quiz=quiz,
        ))

    return RoadmapOutput(
        track=track,
        level=level,
        goal=goal,
        total_duration=arch.get("total_duration") or "Self-paced",
        summary=arch.get("summary") or f"A personalized learning path for {track}.",
        display_hint=(arch.get("display_hint") or "timeline").lower(),
        phases=phases,
    )


def _fallback_roadmap(track: str, level: str, goal: str) -> RoadmapOutput:
    """Minimal valid roadmap when the LLM is unavailable."""
    phases = []
    titles = ["Foundation", "Core Skills", "Applied Practice", "Advanced", "Launch"]
    for pi, ptitle in enumerate(titles, 1):
        tasks = [
            RoadmapTask(
                id=f"p{pi}t{ti}",
                title=f"{ptitle} topic {ti} for {track}",
                description="Study the fundamentals and practice.",
                duration="1 week",
                resources=[
                    ResourceItem(
                        title=f"{track} — video tutorials", type="video",
                        url=PLATFORM_SEARCH_URLS["youtube"].format(
                            q=urllib.parse.quote_plus(track)),
                    ),
                    ResourceItem(
                        title=f"{track} — courses", type="course",
                        url=PLATFORM_SEARCH_URLS["coursera"].format(
                            q=urllib.parse.quote_plus(track)),
                    ),
                ],
            )
            for ti in range(1, MIN_TOPICS_PER_PHASE + 1)
        ]
        phases.append(RoadmapPhase(
            phase_number=pi, title=ptitle,
            description=f"{ptitle} stage of your {track} journey.",
            duration="3 weeks", tasks=tasks,
            project=PhaseProject(
                title=f"{ptitle} project",
                description=f"Apply what you learned in the {ptitle.lower()} phase.",
                deliverable="A small portfolio-worthy artifact.",
                estimated_hours=6,
            ),
            quiz=[],
        ))
    return RoadmapOutput(
        track=track, level=level, goal=goal, total_duration="Self-paced",
        summary=f"A personalized learning path for {track}.",
        display_hint="timeline", phases=phases,
    )


# ══════════════════════════════════════════════════════════════
# Public API
# ══════════════════════════════════════════════════════════════

def generate_roadmap(
    track: str,
    level: str,
    goal: str,
    note: str = "",
    completed_tasks: Optional[List[str]] = None,
) -> RoadmapOutput:
    """Run the full pipeline. Returns a validated RoadmapOutput (never raises)."""
    try:
        profile = _run_profile_analyzer(track, level, goal)
        gaps    = _run_skill_gap_mapper(profile)
        arch    = _run_architect(profile, gaps, track, level, goal, note, completed_tasks)

        if not arch.get("phases"):
            print("[RoadmapAgent] Architect returned no phases — using fallback.")
            return _fallback_roadmap(track, level, goal)

        arch = _run_course_curator(arch, profile)
        arch = _run_quiz_generator(arch, profile)
        arch = _run_task_generator(arch, profile)
        arch = _run_timeline_planner(arch, profile)
        return _to_output(arch, track, level, goal)
    except Exception as exc:
        print(f"[RoadmapAgent] Generation error: {exc}")
        return _fallback_roadmap(track, level, goal)


def refresh_roadmap(stored_roadmap: dict, track: str, level: str, goal: str) -> RoadmapOutput:
    """Regenerate taking the user's completed topics into account."""
    completed_tasks = []
    for phase in stored_roadmap.get("phases", []):
        for task in phase.get("tasks", []):
            if task.get("completed"):
                completed_tasks.append(task.get("title", ""))
    return generate_roadmap(
        track=track, level=level, goal=goal,
        note="Build on the user's progress. Adjust remaining topics and suggest advanced next steps.",
        completed_tasks=completed_tasks or None,
    )
