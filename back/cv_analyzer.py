"""
cv_analyzer.py — CV / resume analyzer (plain Groq).

Pipeline (never raises — always returns a report dict):
  1. pdf_to_text                — extract text from the uploaded PDF
  2. extract_requirements       — market skills for the target job title (LLM)
  3. extract_cv_skills          — skills the candidate demonstrates (LLM)
  4. semantic_skill_match       — matched / partial / missing (LLM)
  5. compute_ats_score          — keyword coverage, sections, contact, formatting
  6. compute_content_quality    — action verbs, metrics, voice, length
  7. analyze_cv                 — orchestrator -> report
  8. weaknesses_to_goal         — build a roadmap "goal" string from the CV gaps

The model is read from llms.py (Groq default) — change it in ONE place.
"""

import re
import json
import string
import unicodedata
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

from llms import groq_client, CV_ANALYZER_MODEL

_MODEL = CV_ANALYZER_MODEL

# Process-level cache: same job title -> same requirements
_REQUIREMENTS_CACHE: Dict[str, Dict] = {}


# ──────────────────────────────────────────────────────────────
# 1. PDF text extraction
# ──────────────────────────────────────────────────────────────

def pdf_to_text(pdf_path: str) -> str:
    """Extract all text from a PDF file. Returns '' on failure."""
    try:
        import pdfplumber
        full = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full += page_text + "\n"
        return full
    except Exception as exc:
        print(f"[CVAnalyzer] pdf_to_text error: {exc}")
        return ""


# ──────────────────────────────────────────────────────────────
# 2. Text cleaning / skill validation
# ──────────────────────────────────────────────────────────────

SKILL_STOPWORDS = {
    "and", "or", "the", "a", "an", "to", "of", "in", "on", "for", "with",
    "using", "used", "use", "by", "as", "at", "from", "into", "via", "etc",
    "solve", "solved", "build", "built", "develop", "developed", "create",
    "created", "design", "designed", "implement", "implemented", "work",
    "worked", "various", "different", "cutting-edge", "state-of-the-art",
    "image", "object", "neural", "networks", "processing", "detection",
}


def clean_and_normalize(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[·●|]", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = unicodedata.normalize("NFKC", text)
    text = text.lower()
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", " ".join(text.split())).strip()


def is_valid_skill(token: str) -> bool:
    if not token:
        return False
    token = token.strip(string.punctuation + " ").lower()
    if len(token) <= 2:
        return False
    if token in SKILL_STOPWORDS:
        return False
    if re.match(r"^\d+$", token):
        return False
    if re.match(r"^[^a-z]+$", token):
        return False
    return True


# ──────────────────────────────────────────────────────────────
# 3. Job requirements
# ──────────────────────────────────────────────────────────────

def extract_requirements(job_title: str) -> Dict:
    cache_key = re.sub(r"\s+", " ", (job_title or "").strip().lower())
    if cache_key in _REQUIREMENTS_CACHE:
        return _REQUIREMENTS_CACHE[cache_key]

    client = groq_client()
    generic = {
        "role": job_title,
        "required_skills": [],
        "required_experience": f"Relevant experience in {job_title}",
        "education": f"Bachelor's degree in a field related to {job_title}",
        "domain_knowledge": [f"Core principles of {job_title}"],
    }
    if client is None:
        print(f"[CVAnalyzer] No Groq client — generic requirements for '{job_title}'.")
        return generic

    system_prompt = """
You are a Job Requirements Analyst. Given ONLY a job title, return VALID JSON with exactly these fields:
{
  "role": string,
  "required_skills": [list of 6-10 hard/technical skills expected in the current job market],
  "required_experience": string,
  "education": string,
  "domain_knowledge": [list of standards/concepts]
}
RULES:
- Return ONLY JSON. No markdown, no explanations.
- Skills must be specific tools/techniques (not soft skills).
- Use current industry-standard requirements for the role.
- Return a STABLE, canonical list — the most universally agreed-upon core skills
  for this role, ordered from most to least important.
""".strip()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Job Title: {job_title}"},
    ]
    for _ in range(3):
        try:
            resp = client.chat.completions.create(
                model=_MODEL, messages=messages, temperature=0.0, seed=42,
                response_format={"type": "json_object"},
            )
            result = json.loads(resp.choices[0].message.content)
            if all(f in result for f in
                   ("role", "required_skills", "required_experience", "education", "domain_knowledge")):
                _REQUIREMENTS_CACHE[cache_key] = result
                return result
        except Exception as exc:
            print(f"[CVAnalyzer] extract_requirements retry: {exc}")
    print(f"[CVAnalyzer] LLM failed for '{job_title}' — generic structure.")
    return generic


# ──────────────────────────────────────────────────────────────
# 4. Extract CV skills
# ──────────────────────────────────────────────────────────────

def extract_cv_skills(cv_text: str) -> List[str]:
    client = groq_client()
    if client is None or not cv_text.strip():
        return []

    system_prompt = """
You are a CV Skills Extractor. Read the full CV text and extract ALL technical skills,
tools, frameworks, programming languages, methodologies, and domain knowledge the
candidate has demonstrated — whether listed explicitly in a Skills section OR implied
through project descriptions, work experience, achievements, or coursework.

Return ONLY a JSON object with a single key "skills" containing a flat list of skill
strings. No markdown, no explanations, no duplicates. Keep names concise and standard.
""".strip()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"CV Text:\n{cv_text[:15000]}"},
    ]
    for _ in range(3):
        try:
            resp = client.chat.completions.create(
                model=_MODEL, messages=messages, temperature=0.0, seed=42,
                response_format={"type": "json_object"},
            )
            result = json.loads(resp.choices[0].message.content)
            skills = result.get("skills", [])
            if not isinstance(skills, list):
                raise ValueError("LLM did not return a 'skills' list")
            return [s.strip() for s in skills if s and s.strip()]
        except Exception as exc:
            print(f"[CVAnalyzer] extract_cv_skills retry: {exc}")
    return []


# ──────────────────────────────────────────────────────────────
# 5. Semantic matching
# ──────────────────────────────────────────────────────────────

def semantic_skill_match(required_skills: List[str], cv_skills: List[str]) -> Dict:
    client = groq_client()
    if client is None or not required_skills:
        return {"matched": [], "partial": [], "missing": list(required_skills)}

    system_prompt = """
You are a fair but rigorous CV skill matcher. For EACH required skill decide if it is:
- "matched": clearly and directly evidenced in the CV.
- "partial": the underlying capability is evidenced, but a specific named tool is not.
- "missing": no real evidence in the CV.

IMPORTANT — a required skill is often a CATEGORY with example tools in parentheses,
e.g. "CRM Software (Salesforce, HubSpot)". Match on the CATEGORY/capability, NOT the
exact tools. The parenthetical tools are only examples.

Return ONLY JSON:
{"matched":[...],"partial":[...],"missing":[...]}
Every required skill appears in exactly one list. No markdown.
""".strip()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content":
            f"Required skills: {json.dumps(required_skills)}\n\nCV skills: {json.dumps(cv_skills)}"},
    ]
    for _ in range(3):
        try:
            resp = client.chat.completions.create(
                model=_MODEL, messages=messages, temperature=0.0, seed=42,
                response_format={"type": "json_object"},
            )
            result = json.loads(resp.choices[0].message.content)
            if "matched" in result and "missing" in result:
                result.setdefault("partial", [])
                return result
        except Exception as exc:
            print(f"[CVAnalyzer] semantic_skill_match retry: {exc}")
    return {"matched": [], "partial": [], "missing": list(required_skills)}


# ──────────────────────────────────────────────────────────────
# 6. ATS score
# ──────────────────────────────────────────────────────────────

def _collect_job_keywords(requirements: Dict) -> List[str]:
    kws = list(requirements.get("required_skills", []))
    kws += list(requirements.get("domain_knowledge", []))
    if requirements.get("role"):
        kws.append(requirements["role"])

    expanded = []
    for k in kws:
        expanded.append(k)
        for grp in re.findall(r"\(([^)]*)\)", k):
            for tool in re.split(r"[\/,]", grp):
                tool = tool.strip()
                if len(tool) > 1:
                    expanded.append(tool)

    seen, out = set(), []
    for k in expanded:
        base = re.sub(r"\([^)]*\)", "", k).strip().lower()
        if base and base not in seen:
            seen.add(base)
            out.append(base)
    return out


def compute_ats_score(raw_cv_text: str, requirements: Dict) -> Dict:
    text = raw_cv_text or ""
    low = text.lower()
    tips = []

    keywords = _collect_job_keywords(requirements)
    found = [k for k in keywords if k in low]
    kw_ratio = (len(found) / len(keywords)) if keywords else 0
    kw_score = round(kw_ratio * 40, 1)
    missing_kw = [k for k in keywords if k not in low]
    if kw_ratio < 0.6 and missing_kw:
        tips.append(f"Add job-relevant keywords the CV is missing, e.g.: {', '.join(missing_kw[:6])}.")

    sections = {
        "experience": r"experience|work history|employment",
        "education": r"education|academic",
        "skills": r"skills|competencies|technical",
        "summary": r"summary|objective|profile",
    }
    present = {n: bool(re.search(p, low)) for n, p in sections.items()}
    sec_score = round(sum(present.values()) / len(sections) * 25, 1)
    for n, ok in present.items():
        if not ok:
            tips.append(f"Add a clearly labeled '{n.capitalize()}' section — ATS systems look for it by name.")

    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text))
    has_phone = bool(re.search(r"(\+?\d[\d\s().-]{7,}\d)", text))
    contact_score = (7.5 if has_email else 0) + (7.5 if has_phone else 0)
    if not has_email:
        tips.append("Add a professional email address.")
    if not has_phone:
        tips.append("Add a phone number.")

    fmt_score = 20.0
    cid_hits = len(re.findall(r"\(cid:\d+\)", text))
    if cid_hits > 0:
        fmt_score -= 6
        tips.append("Replace icon/graphic bullets with plain text bullets — they break in ATS parsers.")
    word_count = len(low.split())
    if word_count < 120:
        fmt_score -= 8
        tips.append("Very little machine-readable text found — make sure the CV is text-based, not a scanned image.")
    special_ratio = len(re.findall(r"[^\w\s@.+\-/(),]", text)) / max(len(text), 1)
    if special_ratio > 0.05:
        fmt_score -= 6
        tips.append("Reduce decorative/special characters; use a simple single-column layout.")
    fmt_score = max(round(fmt_score, 1), 0)

    overall = round(kw_score + sec_score + contact_score + fmt_score, 1)
    if overall >= 80:
        rating = "Excellent - ATS friendly"
    elif overall >= 60:
        rating = "Good - minor improvements needed"
    elif overall >= 40:
        rating = "Fair - several issues to fix"
    else:
        rating = "Poor - likely to be filtered out"

    return {
        "ats_score": overall,
        "ats_rating": rating,
        "breakdown": {
            "keyword_match": {"score": kw_score, "max": 40,
                              "keywords_found": len(found), "keywords_total": len(keywords)},
            "section_structure": {"score": sec_score, "max": 25, "sections_present": present},
            "contact_info": {"score": contact_score, "max": 15, "email": has_email, "phone": has_phone},
            "formatting": {"score": fmt_score, "max": 20, "garbled_glyphs": cid_hits, "word_count": word_count},
        },
        "improvement_tips": tips if tips else ["Looks solid — no major ATS issues detected."],
    }


# ──────────────────────────────────────────────────────────────
# 7. Content-quality score
# ──────────────────────────────────────────────────────────────

STRONG_ACTION_VERBS = {
    "led", "built", "designed", "created", "developed", "managed", "launched",
    "increased", "reduced", "improved", "delivered", "implemented", "drove",
    "achieved", "grew", "optimized", "automated", "established", "mentored",
    "produced", "executed", "streamlined", "boosted", "generated", "negotiated",
    "spearheaded", "coordinated", "analyzed", "trained", "cut", "saved",
}

WEAK_OPENERS = {
    "responsible", "worked", "helped", "assisted", "handled", "involved",
    "participated", "tasked", "duties", "various",
}


def _experience_lines(text: str) -> List[str]:
    lines = []
    for raw in text.split("\n"):
        line = raw.strip().lstrip("-•*● ").strip()
        if len(line.split()) >= 4 and re.search(r"[a-zA-Z]", line):
            lines.append(line)
    return lines


def compute_content_quality_score(raw_cv_text: str) -> Dict:
    text = raw_cv_text or ""
    lines = _experience_lines(text)
    tips = []

    quant_lines = [l for l in lines if re.search(r"\d", l)]
    quant_ratio = (len(quant_lines) / len(lines)) if lines else 0
    quant_score = round(min(quant_ratio / 0.5, 1.0) * 35, 1)
    if quant_ratio < 0.4:
        tips.append("Add quantifiable achievements (numbers, %, time saved, scale). "
                    "e.g. 'Increased X by 30%' instead of 'Improved X'.")

    strong_hits = 0
    for l in lines:
        first = re.sub(r"[^a-zA-Z]", "", l.split()[0].lower()) if l.split() else ""
        if first in STRONG_ACTION_VERBS:
            strong_hits += 1
    strong_ratio = (strong_hits / len(lines)) if lines else 0
    strong_score = round(min(strong_ratio / 0.6, 1.0) * 25, 1)
    if strong_ratio < 0.5:
        tips.append("Start more bullet points with strong action verbs (Led, Built, Increased).")

    low = text.lower()
    weak_hits = sum(len(re.findall(r"\b" + re.escape(w) + r"\b", low)) for w in WEAK_OPENERS)
    weak_score = round(15.0 if weak_hits == 0 else max(15 - weak_hits * 3, 0), 1)
    if weak_hits > 0:
        tips.append("Remove weak phrases like 'responsible for' / 'worked on' / 'helped'.")

    first_person = len(re.findall(r"\b(i|my|me)\b", low))
    fp_score = round(10.0 if first_person == 0 else max(10 - first_person * 2, 0), 1)
    if first_person > 0:
        tips.append("Avoid first-person pronouns ('I', 'my'); start lines with the verb.")

    wc = len(low.split())
    if wc < 150:
        length_score = round(wc / 150 * 15, 1)
        tips.append("The CV is quite short — add more detail to experience and projects.")
    elif wc > 900:
        length_score = round(max(15 - (wc - 900) / 100, 5), 1)
        tips.append("The CV is long — tighten it so the strongest points stand out.")
    else:
        length_score = 15.0

    overall = round(quant_score + strong_score + weak_score + fp_score + length_score, 1)
    if overall >= 80:
        rating = "Strong - well-written CV"
    elif overall >= 60:
        rating = "Good - some writing improvements possible"
    elif overall >= 40:
        rating = "Fair - needs stronger phrasing and metrics"
    else:
        rating = "Weak - rewrite with achievements and action verbs"

    return {
        "content_score": overall,
        "content_rating": rating,
        "breakdown": {
            "quantifiable_achievements": {"score": quant_score, "max": 35,
                                          "quantified_lines": len(quant_lines), "total_lines": len(lines)},
            "action_verbs": {"score": strong_score, "max": 25,
                             "strong_openers": strong_hits, "total_lines": len(lines)},
            "weak_phrasing": {"score": weak_score, "max": 15, "weak_hits": weak_hits},
            "voice": {"score": fp_score, "max": 10, "first_person_hits": first_person},
            "length": {"score": length_score, "max": 15, "word_count": wc},
        },
        "improvement_tips": tips if tips else ["Well-written — strong, metric-driven phrasing."],
    }


# ──────────────────────────────────────────────────────────────
# 8. Orchestrator
# ──────────────────────────────────────────────────────────────

def analyze_cv(cv_pdf_path: str, job_title: str) -> Dict:
    """Full CV analysis. Returns a report dict. Never raises."""
    extracted_cv = pdf_to_text(cv_pdf_path)
    requirements = extract_requirements(job_title)

    raw_skills = extract_cv_skills(extracted_cv)
    cv_skills_clean, seen = [], set()
    for s in raw_skills:
        norm = clean_and_normalize(s)
        if is_valid_skill(norm) and norm not in seen:
            seen.add(norm)
            cv_skills_clean.append(s.strip())

    match = semantic_skill_match(requirements.get("required_skills", []), cv_skills_clean)
    matched = match["matched"]
    partial = match.get("partial", [])
    missing = match["missing"]

    total_required = len(requirements.get("required_skills", []))
    weighted = len(matched) + 0.5 * len(partial)
    match_score = (weighted / total_required * 100) if total_required > 0 else 0

    if match_score >= 70:
        verdict = "Good fit"
    elif match_score >= 50:
        verdict = "Partial fit - some gaps"
    else:
        verdict = "Not a strong fit"

    ats = compute_ats_score(extracted_cv, requirements)
    quality = compute_content_quality_score(extracted_cv)

    return {
        "job_title": job_title,
        "match_score": round(match_score, 1),
        "verdict": verdict,
        "ats_score": ats["ats_score"],
        "ats_rating": ats["ats_rating"],
        "ats_breakdown": ats["breakdown"],
        "ats_improvement_tips": ats["improvement_tips"],
        "content_score": quality["content_score"],
        "content_rating": quality["content_rating"],
        "content_breakdown": quality["breakdown"],
        "content_improvement_tips": quality["improvement_tips"],
        "required_skills": requirements.get("required_skills", []),
        "strengths": matched,
        "partial_matches": partial,
        "weaknesses": missing,
        "cv_skills_found": sorted(cv_skills_clean, key=str.lower),
        "extracted_text_preview": extracted_cv[:500],
    }


def weaknesses_to_goal(job_title: str, weaknesses: List[str], partial: List[str] = None) -> str:
    """Build a roadmap 'goal' string from the CV gaps."""
    missing = list(weaknesses or [])
    deepen = list(partial or [])

    if missing:
        gap_str = ", ".join(missing[:10])
        goal = (f"Become job-ready for a {job_title} role by mastering these missing CV skills: "
                f"{gap_str}.")
        if deepen:
            goal += f" Also deepen these partially-covered skills: {', '.join(deepen[:6])}."
        goal += " Each skill should end with a portfolio project that can be added to the CV."
        return goal

    if deepen:
        deep_str = ", ".join(deepen[:10])
        return (f"Strengthen the partially-covered skills for a {job_title} role to full proficiency: "
                f"{deep_str}. Build a portfolio project for each so they become CV-ready strengths.")

    return (f"Advance an already-qualified {job_title} candidate to the next level with "
            f"advanced, in-demand skills and a standout portfolio project.")
