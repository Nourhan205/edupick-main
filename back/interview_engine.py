"""
Track Discovery Interview Engine
Port of RAG_FINALLL_V_LAST.ipynb → stateful HTTP-friendly module.

Session lifecycle (called from app.py routes):
    engine.start_session(user_name, path_type, email) → {session_id, question, ...}
    engine.answer(session_id, answer)                 → {done, question, ...}  OR  {done:True, result}
    engine.get_result(session_id)                     → result dict (if done)
"""

import os
import json
import uuid
import re
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

# ── paths ────────────────────────────────────────────────────
# RAG data ships inside the backend (back/data) so it can deploy standalone.
# DATA_DIR / CHROMA_DIR can be overridden via env (e.g. a mounted disk).
_BACK_DIR   = Path(__file__).parent
_DATA_DIR   = Path(os.getenv("DATA_DIR", _BACK_DIR / "data"))
_FRONT_DATA = _BACK_DIR.parent / "Front" / "graduation-project--front" / "src" / "data"

def _data_path(name: str) -> Path:
    """Prefer back/data; fall back to the legacy frontend data folder."""
    p = _DATA_DIR / name
    return p if p.exists() else (_FRONT_DATA / name)

COLLEGES_JSON = _data_path("chatbot_final_data.json")
TRACKS_XLSX   = _data_path("all_tracks.xlsx")
CHROMA_DIR    = os.getenv("CHROMA_DIR", str(_BACK_DIR / "chroma_interview"))

# ── LLM tier assignment (Groq now; OpenRouter variants kept in llms.py) ──
from llms import groq_llm as _q_llm    # interview questions
from llms import groq_llm as _ext_llm  # keyword extraction

TOTAL_QUESTIONS = 4

# ────────────────────────────────────────────────────────────
# Session dataclass
# ────────────────────────────────────────────────────────────

@dataclass
class InterviewSession:
    session_id: str
    user_name: str
    path_type: str                          # "track_only" | "college_and_track"
    email: Optional[str] = None

    # Profile context (pulled from the user's account at signup)
    age: Optional[int] = None
    status: Optional[str] = None            # "student" | "graduate"
    study_level: Optional[str] = None       # "high_school" | "college"

    conversation_history: list = field(default_factory=list)
    current_question: int = 0              # which question is currently pending
    pending_question: str = ""             # text of the question currently asked
    done: bool = False
    result: Optional[dict] = None


# ────────────────────────────────────────────────────────────
# Document builders (mirror notebook cells 3 & 4)
# ────────────────────────────────────────────────────────────

def _build_college_docs(json_path: Path) -> list:
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)
    docs = []
    def _d(obj, key):
        """Null-safe nested dict accessor (some records have null fields)."""
        v = (obj or {}).get(key)
        return v if isinstance(v, dict) else {}

    def _list(obj, key, lang):
        v = _d(obj, key).get(lang, [])
        return ", ".join(v) if isinstance(v, list) else (str(v) if v else "")

    for idx, item in enumerate(data):
        item = item or {}
        meta = item.get("metadata") or {}
        university_ar = _d(meta, "university").get("ar", "")
        faculty_ar    = _d(meta, "faculty").get("ar", "")
        department_ar = _d(meta, "department").get("ar", "")
        description   = _d(item, "page_content").get("ar", "")
        interests_ar  = _list(meta, "interests", "ar")
        subjects_ar   = _list(meta, "strong_subjects", "ar")
        skills_ar     = _list(meta, "required_skills", "ar")
        careers_ar    = _list(meta, "career_paths", "ar")
        learning_ar   = _list(meta, "learning_style", "ar")
        department_en = _d(meta, "department").get("en", "")
        interests_en  = _list(meta, "interests", "en")
        skills_en     = _list(meta, "required_skills", "en")

        content = (
            f"الجامعة: {university_ar}\n"
            f"الكلية: {faculty_ar}\n"
            f"القسم: {department_ar}\n\n"
            f"وصف البرنامج:\n{description}\n\n"
            f"الاهتمامات: {interests_ar}\n"
            f"المواد الأساسية: {subjects_ar}\n"
            f"المهارات المطلوبة: {skills_ar}\n"
            f"أسلوب الدراسة: {learning_ar}\n"
            f"المسارات المهنية: {careers_ar}\n\n"
            f"--- English Keywords ---\n"
            f"Department: {department_en}\n"
            f"Interests: {interests_en}\n"
            f"Skills: {skills_en}"
        )
        docs.append(Document(
            page_content=content.strip(),
            metadata={
                "id":         item.get("id", f"college_{idx}"),
                "university": university_ar,
                "faculty":    faculty_ar,
                "department": department_ar,
                "type":       "faculty_department_profile",
            }
        ))
    return docs


def _build_track_docs(xlsx_path: Path) -> list:
    import pandas as pd
    df = pd.read_excel(xlsx_path).fillna("")
    docs = []
    for _, row in df.iterrows():
        track_ar    = str(row.get("Track_Name_Arabic",  ""))
        track_en    = str(row.get("Track_Name_English", ""))
        category_ar = str(row.get("Category_Arabic",    ""))
        level       = str(row.get("Level",              ""))
        duration    = str(row.get("Duration_Months",    ""))
        core_skills = str(row.get("Core_Skills",        ""))
        soft_skills = str(row.get("Soft_Skills_Arabic", ""))
        job_roles   = str(row.get("Job_Roles",          ""))

        content = (
            f"المسار المهني: {track_ar}\n"
            f"الفئة: {category_ar}\n"
            f"المستوى: {level}\n"
            f"مدة التعلم: {duration} شهر\n\n"
            f"المهارات الأساسية: {core_skills}\n"
            f"المهارات السلوكية: {soft_skills}\n"
            f"الوظائف المحتملة: {job_roles}\n\n"
            f"--- English Keywords ---\n"
            f"Track: {track_en}"
        )
        docs.append(Document(
            page_content=content.strip(),
            metadata={
                "Track_Name_Arabic":  track_ar,
                "Track_Name_English": track_en,
                "type":               "career_track",
            }
        ))
    return docs


# ────────────────────────────────────────────────────────────
# Prompt helpers (mirror notebook cells 8-10)
# ────────────────────────────────────────────────────────────

def _profile_line(session: InterviewSession) -> str:
    """Human-readable Arabic profile snippet injected into prompts."""
    bits = []
    if session.age:
        bits.append(f"العمر: {session.age}")
    if session.status == "student":
        if session.study_level == "high_school":
            bits.append("الحالة: طالب ثانوية")
        elif session.study_level == "college":
            bits.append("الحالة: طالب جامعي")
        else:
            bits.append("الحالة: طالب")
    elif session.status == "graduate":
        bits.append("الحالة: خريج")
    return " — ".join(bits) if bits else "لا توجد بيانات إضافية"


def _system_prompt(session: InterviewSession) -> str:
    n, t = session.user_name, session.path_type
    profile = _profile_line(session)
    if t == "track_only":
        return (
            f"أنت مستشار مسارات تدريبية محترف تُجري مقابلة مباشرة مع {n}، وهو يجيب أمامك الآن.\n"
            f"اسم الشخص: {n} — معلومات عنه: {profile}\n"
            f"هدف المقابلة: مساعدة {n} في تحديد التراك التدريبي الأكثر توافقاً مع مهاراته.\n"
            f"المقابلة من {TOTAL_QUESTIONS} أسئلة فقط — مرحلة جمع معلومات، بدون توصيات الآن.\n\n"
            "الأهداف: المهارات الحالية، الاهتمامات، مستوى الخبرة، أسلوب التعلم، الهدف النهائي.\n\n"
            "قواعد صارمة:\n"
            "- سؤال واحد فقط في كل مرة.\n"
            "- كل سؤال مبني على الإجابات السابقة.\n"
            f"- استخدم اسم {n} بشكل طبيعي وخاطبه مباشرة.\n"
            "- أسلوب مقابلة حقيقي (واضح – مباشر – ودود).\n"
            "- لا تقدم أي ترشيحات الآن."
        )
    else:
        return (
            f"أنت مستشار أكاديمي ومهني محترف متخصص في توجيه طلاب الثانوية، تُجري مقابلة مباشرة مع {n} وهو يجيب أمامك.\n"
            f"اسم الشخص: {n} — معلومات عنه: {profile}\n"
            f"ملاحظة مهمة: {n} خريج/ـة ثانوية ومُقبل على اختيار الكلية والتخصص الجامعي (طالب)، فاجعل أسئلتك مناسبة لهذه المرحلة.\n"
            f"هدف المقابلة: مساعدة {n} في اختيار الكلية والتخصص الأنسب.\n"
            f"المقابلة من {TOTAL_QUESTIONS} أسئلة فقط — مرحلة فهم وتحليل فقط.\n\n"
            "الأهداف: الاهتمامات الأكاديمية، المواد المفضلة، الأهداف المهنية، أسلوب التعلم.\n\n"
            "قواعد صارمة:\n"
            "- سؤال واحد فقط في كل مرة.\n"
            "- كل سؤال مبني على الإجابات السابقة.\n"
            f"- استخدم اسم {n} بشكل طبيعي وخاطبه مباشرة.\n"
            "- لا توصيات الآن."
        )


def _format_answers(history: list) -> str:
    lines = []
    for item in history:
        lines.append(
            f"السؤال {item['question_number']}: {item['question']}\n"
            f"الإجابة: {item['answer']}\n"
            "───────────────────────────────────"
        )
    return "\n".join(lines)


_ANSWER_STYLE = (
    "\n\nأسلوب السؤال (إلزامي): اطرح سؤالاً واحداً واضحاً ومتوسط الطول — لا قصيراً جداً ولا طويلاً معقّداً — "
    "بلغة بسيطة يفهمها أي شخص. اشرح في السؤال ما تقصده بإيجاز، ثم اطلب من الشخص صراحةً أن يجيب بالتفصيل "
    "ويذكر أمثلة وأسبابًا (مثل: «اشرح لي بالتفصيل وقول لي كل اللي في بالك»). يجب أن يكون السؤال احترافيًا "
    "ويستكشف نقطة جديدة تساعد فعلاً على ترشيح دقيق. أخرج نص السؤال فقط."
)


def _question_prompt(session: InterviewSession, rag_context: str = "") -> str:
    n    = session.user_name
    q    = session.current_question
    hist = session.conversation_history

    rag_block = ""
    if rag_context:
        rag_block = (
            "\n\nسياق مرجعي (مسارات/تخصصات قريبة من إجابات المستخدم — استرشد بها لتطرح سؤالاً أدق "
            "يميّز بين هذه الاتجاهات، دون ذكرها أو الترشيح بها صراحةً):\n"
            f"{rag_context}\n"
        )

    if q == 1:
        hint = (
            "يجب أن يكون سؤالاً عن المهارات الحالية والاهتمامات التدريبية."
            if session.path_type == "track_only"
            else "يجب أن يكون سؤالاً عن الاهتمامات الأكاديمية والمواد المفضلة في الثانوية."
        )
        return (
            f"أنت الآن في بداية المقابلة مع {n}.\n"
            f"السؤال الحالي: 1 من {TOTAL_QUESTIONS}\n"
            "لا توجد إجابات سابقة.\n\n"
            f"اطرح السؤال الأول لـ {n}.\n{hint}"
            + _ANSWER_STYLE
        )
    else:
        last_ans = hist[-1]["answer"]
        return (
            f"السؤال الحالي: {q} من {TOTAL_QUESTIONS}\n"
            f"الأسئلة المتبقية: {TOTAL_QUESTIONS - q}\n\n"
            f"ملخص المقابلة مع {n} حتى الآن:\n"
            f"{_format_answers(hist)}\n\n"
            f"آخر إجابة من {n}: \"{last_ans}\"{rag_block}\n\n"
            f"اطرح السؤال رقم {q} لـ {n}.\n"
            "يجب أن يكون مبنياً على الإجابات السابقة ويغطي جانباً جديداً."
            + _ANSWER_STYLE
        )


def _track_keywords_prompt(answers_summary: str, user_name: str) -> str:
    return (
        f"لديك مقابلة مكتملة مع {user_name} بهدف اختيار مسار تدريبي مناسب.\n\n"
        f"إجابات المقابلة:\n{answers_summary}\n\n"
        "مهمتك: حلّل الإجابات كمستشار مهني، وأرجع JSON خام فقط — بدون markdown أو نص إضافي.\n\n"
        "قواعد صارمة: JSON فقط. لا تكرار. لا افتراضات غير مدعومة بالإجابات.\n\n"
        "{\n"
        '  "interests": ["اهتمام تطبيقي واضح"],\n'
        '  "skills": ["مهارة تقنية أو مهنية"],\n'
        '  "career_goals": ["هدف مهني واقعي"],\n'
        '  "search_queries_arabic": ["كلمة بحث عربية دقيقة"],\n'
        '  "search_queries_english": ["technical keyword"],\n'
        '  "preferred_tracks": ["اسم تراك محتمل"]\n'
        "}"
    )


def _college_keywords_prompt(answers_summary: str, user_name: str) -> str:
    return (
        f"لديك مقابلة مكتملة مع {user_name}، خريج ثانوية، بهدف اختيار الكلية والقسم.\n\n"
        f"إجابات المقابلة:\n{answers_summary}\n\n"
        "مهمتك: حلّل الإجابات كمرشد أكاديمي، وأرجع JSON خام فقط — بدون markdown أو نص إضافي.\n\n"
        "{\n"
        '  "interests": ["اهتمام أكاديمي واضح"],\n'
        '  "skills": ["مهارة دراسية أو تحليلية"],\n'
        '  "career_goals": ["هدف مهني بعد التخرج"],\n'
        '  "search_queries_arabic": ["اسم كلية أو تخصص بالعربية"],\n'
        '  "search_queries_english": ["academic major keyword"],\n'
        '  "preferred_departments": ["اسم قسم أو كلية محتملة"]\n'
        "}"
    )


def _focused_query(kw: Optional[dict], pref_key: str) -> str:
    """Build a clean natural-language retrieval query from extracted keywords.

    Dumping the whole keyword JSON into the embedder adds noise (field names,
    brackets, generic search strings) and hurts relevance. Instead we join the
    most meaningful signals — the model's explicit picks, the career goal, the
    interests — into a focused phrase, repeating the explicit picks so they
    dominate the embedding.
    """
    if not isinstance(kw, dict):
        return ""
    chunks = []
    def add(val):
        if isinstance(val, list):
            chunks.extend(str(x).strip() for x in val if str(x).strip())
        elif val:
            chunks.append(str(val).strip())
    # weight the explicit preferred picks the most
    add(kw.get(pref_key))
    add(kw.get(pref_key))
    add(kw.get("career_goals"))
    add(kw.get("interests"))
    add(kw.get("skills"))
    add(kw.get("search_queries_arabic"))
    return " ، ".join(chunks)


def _parse_json_response(raw: str) -> Optional[dict]:
    cleaned = re.sub(r"```json\s*|\s*```", "", raw.strip())
    start = cleaned.find("{")
    if start == -1:
        return None
    depth = end = 0
    for i, ch in enumerate(cleaned[start:], start):
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    try:
        return json.loads(cleaned[start:end])
    except Exception:
        return None


def _final_report_prompt(session: InterviewSession, answers_summary: str,
                          track_kw, college_kw,
                          track_results: list, college_results: list,
                          suggested_tracks: list = None, suggested_colleges: list = None) -> tuple:
    """Returns (system_prompt, user_prompt) for the final report.

    The report is forced to recommend EXACTLY the same top-3 tracks/colleges that
    the structured `suggested_tracks` / `suggested_colleges` contain, so the text
    report and the UI chips always match.
    """
    n  = session.user_name
    pt = session.path_type
    suggested_tracks = suggested_tracks or []
    suggested_colleges = suggested_colleges or []

    track_list = "\n".join(
        f"   {i}. {t['name']}" for i, t in enumerate(suggested_tracks, 1)
    ) or "   (لا يوجد)"
    college_list = "\n".join(
        f"   {i}. {c['name']}" for i, c in enumerate(suggested_colleges, 1)
    ) or "   (لا يوجد)"

    track_results_text = "نتائج البحث — التراكات التدريبية:\n\n"
    for i, doc in enumerate(track_results[:5], 1):
        track_results_text += f"تراك {i}\nMetadata: {doc['metadata']}\n{doc['content']}\n\n"

    if pt == "track_only":
        system = (
            "أنت مستشار مسارات تدريبية وخبير توجيه مهني. لقد انتهيت للتو من إجراء مقابلة "
            f"مع {n}، والآن تقدّم له تقريرك النهائي وأنت تخاطبه مباشرة وجهاً لوجه."
        )
        user = (
            f"الشخص الذي قابلته اسمه: {n}\n\n"
            f"إجابات {n} في المقابلة:\n{answers_summary}\n\n"
            f"تحليل الاهتمامات:\n{json.dumps(track_kw, ensure_ascii=False, indent=2)}\n\n"
            f"{track_results_text}\n"
            "التراكات الثلاثة المرشّحة (إلزامي استخدامها كما هي بالضبط وبنفس الترتيب، "
            "بنفس الأسماء حرفياً دون ترجمة أو تغيير أو إضافة غيرها):\n"
            f"{track_list}\n\n"
            f"اكتب الآن تقريراً موجهاً إلى {n} مباشرة بصيغة المخاطب (استخدم: أنت، إجاباتك، يناسبك، ننصحك)، "
            "ويحتوي على:\n"
            "1) تحليل شخصي له (فقرتان) — \"من خلال إجاباتك لاحظتُ أنك...\"\n"
            "2) التراكات الثلاثة المرشّحة أعلاه بالضبط (نفس الأسماء والترتيب) — لكل تراك: لماذا يناسبك أنت تحديداً، مدة التدريب، المهارات، الوظائف، تحدٍ محتمل\n"
            "3) نصائح عملية مخصصة لك (3-4 نقاط)\n"
            "4) موارد مقترحة\n\n"
            f"قواعد: لا تخترع تراكات غير المذكورة أعلاه ولا تحذف أيًّا منها. لا نسب أو أرقام تقييم. "
            f"اربط كل استنتاج بإجابات {n}. خاطبه بصيغة \"أنت\" طوال التقرير. واضح ومختصر."
        )
    else:
        college_results_text = "نتائج البحث — الكليات والأقسام:\n\n"
        for i, doc in enumerate(college_results[:5], 1):
            college_results_text += f"كلية {i}\nMetadata: {doc['metadata']}\n{doc['content']}\n\n"

        system = (
            "أنت مستشار أكاديمي ومهني خبير في توجيه طلاب الثانوية. انتهيت للتو من مقابلة "
            f"مع {n}، والآن تقدّم له تقريرك النهائي مخاطباً إياه مباشرة."
        )
        user = (
            f"الطالب الذي قابلته اسمه: {n} — خريج ثانوية مقبل على الجامعة\n\n"
            f"إجابات {n} في المقابلة:\n{answers_summary}\n\n"
            f"تحليل الاهتمامات الأكاديمية:\n{json.dumps(college_kw, ensure_ascii=False, indent=2)}\n\n"
            f"تحليل الميول المهنية:\n{json.dumps(track_kw, ensure_ascii=False, indent=2)}\n\n"
            f"{college_results_text}\n"
            f"{track_results_text}\n"
            "الكليات الثلاث المرشّحة (إلزامي استخدامها كما هي بالضبط وبنفس الترتيب):\n"
            f"{college_list}\n\n"
            "التراكات الثلاثة المرشّحة (إلزامي استخدامها كما هي بالضبط وبنفس الترتيب، بنفس الأسماء حرفياً):\n"
            f"{track_list}\n\n"
            f"اكتب الآن تقريراً موجهاً إلى {n} مباشرة بصيغة المخاطب (أنت، إجاباتك، يناسبك)، ويحتوي على:\n"
            "1) تحليل أكاديمي ومهني لك (فقرتان)\n"
            "2) الكليات الثلاث المرشّحة أعلاه بالضبط (نفس الأسماء والترتيب) — لكل كلية: لماذا تناسبك، مواد، مهارات، مسارات، تحدٍ\n"
            "3) التراكات الثلاثة المرشّحة أعلاه بالضبط (نفس الأسماء والترتيب) — لكل تراك: كيف يدعمك، مدة، مهارات، قيمة مضافة\n"
            "4) نصائح عملية لك (3-4 نقاط)\n"
            "5) موارد مقترحة\n\n"
            f"قواعد: لا تخترع كليات أو تراكات غير المذكورة أعلاه ولا تحذف أيًّا منها. لا نسب أو أرقام. "
            f"اربط كل توصية بإجابات {n}. خاطبه بصيغة \"أنت\" طوال التقرير. واضح ومختصر."
        )

    return system, user


# ────────────────────────────────────────────────────────────
# Engine
# ────────────────────────────────────────────────────────────

class InterviewEngine:
    """
    Manages stateful interview sessions in memory.
    Suitable for single-process Flask dev/demo.
    """

    def __init__(self):
        self._sessions: dict[str, InterviewSession] = {}
        self._embeddings = None          # loaded lazily on first session
        self._college_vs: Optional[Chroma] = None
        self._track_vs:   Optional[Chroma] = None
        self._splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        self._ready = False              # True after vector stores built

    def _ensure_ready(self):
        if self._ready:
            return
        print("[Interview] Initialising embeddings & vector stores (first use)...")
        self._embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )
        self._init_vector_stores()
        self._ready = True

    # ── Vector store init ────────────────────────────────────

    def _init_vector_stores(self):
        self._college_vs = self._load_or_build(
            name="colleges",
            collection="interview_colleges",
            data_path=COLLEGES_JSON,
            builder=_build_college_docs,
        )
        self._track_vs = self._load_or_build(
            name="tracks",
            collection="interview_tracks",
            data_path=TRACKS_XLSX,
            builder=_build_track_docs,
        )

    def _load_or_build(self, name, collection, data_path, builder) -> Optional[Chroma]:
        if not data_path.exists():
            print(f"[Interview] WARNING: {data_path} not found — {name} search disabled.")
            return None

        persist = os.path.join(CHROMA_DIR, name)
        try:
            vs = Chroma(
                persist_directory=persist,
                embedding_function=self._embeddings,
                collection_name=collection,
            )
            count = vs._collection.count()
            if count > 0:
                print(f"[Interview] Loaded {name} VS ({count} chunks).")
                return vs
            raise ValueError("empty collection")
        except Exception:
            print(f"[Interview] Building {name} VS (first run — may take a moment)...")
            docs = builder(data_path)
            vs = Chroma.from_documents(
                self._splitter.split_documents(docs),
                embedding=self._embeddings,
                persist_directory=persist,
                collection_name=collection,
            )
            print(f"[Interview] Built {name} VS ({vs._collection.count()} chunks).")
            return vs

    # ── Public API ───────────────────────────────────────────

    def start_session(self, user_name: str, path_type: str,
                      email: Optional[str] = None,
                      profile: Optional[dict] = None) -> dict:
        self._ensure_ready()
        profile = profile or {}
        session = InterviewSession(
            session_id=str(uuid.uuid4()),
            user_name=user_name.strip(),
            path_type=path_type,
            email=email,
            age=profile.get("age"),
            status=profile.get("status"),
            study_level=profile.get("study_level"),
        )
        session.current_question = 1
        question_text = self._ask(session)
        session.pending_question = question_text
        self._sessions[session.session_id] = session

        return {
            "session_id": session.session_id,
            "question": question_text,
            "question_number": 1,
            "total_questions": TOTAL_QUESTIONS,
        }

    def answer(self, session_id: str, user_answer: str) -> dict:
        session = self._sessions.get(session_id)
        if not session:
            return {"error": "Session not found or expired."}
        if session.done:
            return {"error": "Session already completed."}

        # Record answer
        session.conversation_history.append({
            "question_number": session.current_question,
            "question":        session.pending_question,
            "answer":          user_answer.strip(),
        })

        if session.current_question >= TOTAL_QUESTIONS:
            # All questions answered — run analysis
            result = self._run_analysis(session)
            session.done   = True
            session.result = result
            return {"done": True, "result": result}

        # Ask next question
        session.current_question += 1
        question_text = self._ask(session)
        session.pending_question = question_text
        return {
            "done":            False,
            "question":        question_text,
            "question_number": session.current_question,
            "total_questions": TOTAL_QUESTIONS,
        }

    def get_result(self, session_id: str) -> Optional[dict]:
        session = self._sessions.get(session_id)
        if session and session.done:
            return session.result
        return None

    # ── Private helpers ──────────────────────────────────────

    def _ask(self, session: InterviewSession) -> str:
        rag_context = self._retrieve_question_context(session)
        messages = [
            SystemMessage(content=_system_prompt(session)),
            HumanMessage(content=_question_prompt(session, rag_context)),
        ]
        response = _q_llm.invoke(messages)
        return response.content.strip()

    def _retrieve_question_context(self, session: InterviewSession) -> str:
        """
        From Q2 onward, ground the next question in RAG results: search the
        relevant vector store with the conversation so far and surface a few
        candidate track/department names + skills to make the question sharper.
        """
        if session.current_question < 2 or not session.conversation_history:
            return ""
        query = " ".join(
            f"{h.get('answer','')}" for h in session.conversation_history
        ).strip()
        if not query:
            return ""
        try:
            vs = (self._college_vs if session.path_type == "college_and_track"
                  else self._track_vs)
            results = self._search(vs, query, k=3)
            lines = []
            for r in results:
                meta = r.get("metadata", {})
                name = (meta.get("Track_Name_Arabic") or meta.get("department")
                        or meta.get("Track_Name_English") or "").strip()
                if name:
                    lines.append(f"- {name}")
            return "\n".join(lines)
        except Exception as exc:
            print(f"[Interview] RAG question context error: {exc}")
            return ""

    def _extract_keywords(self, prompt_text: str) -> Optional[dict]:
        messages = [
            SystemMessage(content="أنت محلل يستخرج JSON خام فقط دون أي نص إضافي."),
            HumanMessage(content=prompt_text),
        ]
        raw = _ext_llm.invoke(messages).content
        return _parse_json_response(raw)

    def _search(self, vs: Optional[Chroma], query: str, k: int = 5) -> list:
        if vs is None:
            return []
        docs = vs.similarity_search(query, k=k)
        return [{"metadata": d.metadata, "content": d.page_content[:600]} for d in docs]

    def _run_analysis(self, session: InterviewSession) -> dict:
        answers_summary = _format_answers(session.conversation_history)
        user_name = session.user_name
        path_type = session.path_type

        # ── 1. Keyword extraction ─────────────────────────────
        track_kw = self._extract_keywords(
            _track_keywords_prompt(answers_summary, user_name)
        )

        college_kw = None
        if path_type == "college_and_track":
            college_kw = self._extract_keywords(
                _college_keywords_prompt(answers_summary, user_name)
            )

        # ── 2. Vector search (focused query → better relevance) ──────
        track_query = _focused_query(track_kw, "preferred_tracks") or answers_summary
        track_results = self._search(self._track_vs, track_query, k=8)

        college_results = []
        if path_type == "college_and_track":
            college_query = _focused_query(college_kw, "preferred_departments") or answers_summary
            college_results = self._search(self._college_vs, college_query, k=8)

        # ── 3. Build structured top-3 track + college suggestions FIRST ──
        # (so the written report can be forced to use exactly the same ones)
        suggested_tracks = self._build_suggested_tracks(track_results, track_kw)
        suggested_track = suggested_tracks[0]["name"] if suggested_tracks else None
        suggested_colleges = self._build_suggested_colleges(college_results)

        # ── 4. Final report (must use the exact suggestions above) ──────
        sys_p, user_p = _final_report_prompt(
            session, answers_summary,
            track_kw, college_kw,
            track_results, college_results,
            suggested_tracks, suggested_colleges,
        )
        report_text = _q_llm.invoke([
            SystemMessage(content=sys_p),
            HumanMessage(content=user_p),
        ]).content.strip()

        return {
            "report":            report_text,
            "track_keywords":    track_kw,
            "college_keywords":  college_kw,
            "track_results":     [r["metadata"] for r in track_results],
            "college_results":   [r["metadata"] for r in college_results],
            "suggested_track":   suggested_track,
            "suggested_tracks":  suggested_tracks,    # [{name, name_ar}] — top 3
            "suggested_colleges": suggested_colleges,  # [{name, university, faculty, department}] — top 3
            "answers":           list(session.conversation_history),
            "path_type":         path_type,
            "user_name":         user_name,
            "email":             session.email,
        }

    def _build_suggested_colleges(self, college_results: list) -> list:
        """Return up to 3 unique college/department suggestions from the vector results."""
        out, seen = [], set()
        for r in college_results:
            meta = r.get("metadata", {})
            university = (meta.get("university") or "").strip()
            faculty    = (meta.get("faculty") or "").strip()
            department = (meta.get("department") or "").strip()
            parts = [p for p in (university, faculty, department) if p]
            if not parts:
                continue
            name = " - ".join(parts)
            key = name.lower()
            if key not in seen:
                seen.add(key)
                out.append({
                    "name": name,
                    "university": university,
                    "faculty": faculty,
                    "department": department,
                })
            if len(out) >= 3:
                break
        return out

    def _build_suggested_tracks(self, track_results: list, track_kw: Optional[dict]) -> list:
        """Return up to 3 unique {name, name_ar} suggestions from the vector results."""
        out, seen = [], set()
        for r in track_results:
            meta = r.get("metadata", {})
            name_en = (meta.get("Track_Name_English") or "").strip()
            name_ar = (meta.get("Track_Name_Arabic") or "").strip()
            name = name_en or name_ar
            key = name.lower()
            if name and key not in seen:
                seen.add(key)
                out.append({"name": name, "name_ar": name_ar or name})
            if len(out) >= 3:
                break
        # Fallback to the LLM's preferred_tracks if vector search gave nothing
        if not out and track_kw and isinstance(track_kw.get("preferred_tracks"), list):
            for t in track_kw["preferred_tracks"][:3]:
                t = str(t).strip()
                if t and t.lower() not in seen:
                    seen.add(t.lower())
                    out.append({"name": t, "name_ar": t})
        return out
