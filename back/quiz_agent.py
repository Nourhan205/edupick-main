"""
quiz_agent.py — Phase 5
Analyzes career aptitude quiz answers and generates personalized insights.
Uses letter-frequency scoring + llm_flash for personalized description.
"""

from collections import Counter
from llms import groq_llm as llm_flash  # using Groq now (OpenRouter kept in llms.py for later)

# ── Track mapping (A–F) ───────────────────────────────────────
TRACK_MAP = {
    "A": "Technology & Software",
    "B": "Business & Management",
    "C": "Engineering",
    "D": "Healthcare & Medicine",
    "E": "Creative Arts & Design",
    "F": "Education & Social Sciences",
}

TRACK_EMOJIS = {
    "A": "💻",
    "B": "📊",
    "C": "⚙️",
    "D": "🏥",
    "E": "🎨",
    "F": "👥",
}


def analyze_quiz(answers: dict) -> dict:
    """
    Analyze a completed quiz.

    Parameters
    ----------
    answers : dict
        {question_id (str/int): selected_option (str A-F)}

    Returns
    -------
    dict with keys:
        top_track, top_key, match_pct, scores, insight, suggested_tracks
    """
    if not answers:
        raise ValueError("answers dict is empty")

    # Normalize keys: ensure option letters are uppercase
    normalized = {str(k): str(v).upper() for k, v in answers.items()}
    total = len(normalized)

    counts = Counter(normalized.values())

    # Build score list for all tracks, sorted descending
    scores = []
    for key, track in TRACK_MAP.items():
        count = counts.get(key, 0)
        pct   = round(count / total * 100)
        scores.append({
            "key":   key,
            "track": track,
            "emoji": TRACK_EMOJIS[key],
            "count": count,
            "pct":   pct,
        })
    scores.sort(key=lambda x: x["count"], reverse=True)

    top = scores[0]

    # Build top-3 profile string for the LLM prompt
    top3 = [s for s in scores[:3] if s["pct"] > 0]
    profile_str = ", ".join(f"{s['track']} ({s['pct']}%)" for s in top3)

    prompt = (
        "You are a supportive educational career advisor helping Egyptian students "
        "choose the right academic track.\n\n"
        f"A student just completed a career aptitude quiz. Their results:\n"
        f"- Top match: {top['track']} ({top['pct']}%)\n"
        f"- Full profile: {profile_str}\n\n"
        "Write exactly 2 warm, encouraging sentences of personalized career guidance. "
        "Mention one concrete next step the student can take. "
        "Do not use markdown or bullet points. Write in plain English."
    )

    try:
        insight = llm_flash.invoke(prompt).content.strip()
    except Exception as exc:
        print(f"[QuizAgent] LLM error: {exc}")
        insight = (
            f"Your results show a strong fit for {top['track']}. "
            "Start by exploring beginner resources and building a portfolio to get your journey going."
        )

    return {
        "top_track":        top["track"],
        "top_key":          top["key"],
        "top_emoji":        top["emoji"],
        "match_pct":        top["pct"],
        "scores":           scores,
        "insight":          insight,
        "suggested_tracks": [s["track"] for s in top3],
    }
