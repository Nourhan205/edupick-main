"""
Career / Track Comparison Tool — Phase 4 core logic.
Exports consumed by app.py:
    llm                  — LLM instance for the agent
    LANG_CONFIG          — Language-specific prompts, criteria labels
    search_web           — SERPER web-search tool instance
    create_comparator_agent — Factory → CrewAI Agent
"""

import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

# Comparison now runs entirely on Groq: we do the web search ourselves (Serper)
# and feed the results to a plain Groq JSON call. This avoids both the
# OpenRouter dependency (out of credits) and CrewAI's Groq tool-calling issue.
_GROQ_MODEL = "llama-3.3-70b-versatile"

# ---------------------------------------------------------------------------
# Language configuration
# ---------------------------------------------------------------------------
LANG_CONFIG = {
    "en": {
        "criteria": {
            "1": "Required Skills",
            "2": "Average Salary",
            "3": "Learning Duration",
            "4": "Market Demand",
            "5": "Difficulty Level",
            "6": "Job Opportunities",
            "7": "Alternative Paths",
        },
        "task_prompt": (
            "Search the web for the most recent available information about these tracks/careers: {tracks}\n\n"
            "Context: Location={location}, Currency={currency}. Reference year: {year} "
            "(use the latest data you can find — recent figures are perfectly fine as estimates for this year).\n"
            "Compare them on: {criteria}\n\n"
            "For EACH criterion and EACH track provide:\n"
            "  - The actual data/value (give your best estimate from recent data — NEVER refuse or leave blank)\n"
            "  - A source URL where this info was found\n\n"
            "IMPORTANT: You must always produce the comparison. If exact current-year data is unavailable, "
            "use the most recent figures and note them as estimates. Do not apologize or decline.\n\n"
            "Return ONLY valid JSON — no markdown, no preamble.\n"
            "CRITICAL STRUCTURE RULE: for every criterion, the \"cells\" array MUST contain exactly one "
            "object per track, in the SAME ORDER as the \"tracks\" array (cells[0] is for tracks[0], "
            "cells[1] is for tracks[1], and so on). Never merge two tracks into one cell and never leave a cell empty.\n\n"
            "{{\n"
            '  "tracks": ["First Track Name", "Second Track Name"],\n'
            '  "rows": [\n'
            '    {{\n'
            '      "criterion": "Required Skills",\n'
            '      "cells": [\n'
            '        {{"value": "value for the FIRST track", "source": "https://..."}},\n'
            '        {{"value": "value for the SECOND track", "source": "https://..."}}\n'
            "      ]\n"
            "    }}\n"
            "  ],\n"
            '  "insights": {{\n'
            '    "highest_salary": "track name",\n'
            '    "fastest_growing": "track name",\n'
            '    "easiest_to_start": "track name",\n'
            '    "summary": "2-3 sentence overall summary"\n'
            "  }}\n"
            "}}"
        ),
        "expected_output": (
            "Valid JSON comparing the requested tracks, with a source URL "
            "for each data point and an insights summary."
        ),
    },
    "ar": {
        "criteria": {
            "1": "المهارات المطلوبة",
            "2": "متوسط الراتب",
            "3": "مدة التعلم",
            "4": "الطلب في السوق",
            "5": "مستوى الصعوبة",
            "6": "فرص العمل",
            "7": "المسارات البديلة",
        },
        "task_prompt": (
            "ابحث على الإنترنت عن أحدث المعلومات المتاحة عن هذه المسارات/الوظائف: {tracks}\n\n"
            "السياق: الموقع={location}، العملة={currency}. السنة المرجعية: {year} "
            "(استخدم أحدث بيانات تجدها — الأرقام الحديثة مقبولة تماماً كتقديرات لهذه السنة).\n"
            "قارنها على أساس: {criteria}\n\n"
            "لكل معيار ولكل مسار قدّم:\n"
            "  - القيمة الفعلية (أعطِ أفضل تقدير من البيانات الحديثة — لا ترفض أبداً ولا تترك فراغاً)\n"
            "  - رابط المصدر الذي وجدت فيه المعلومة\n\n"
            "مهم: يجب دائماً إنتاج المقارنة. إذا لم تتوفر بيانات دقيقة للسنة الحالية، "
            "استخدم أحدث الأرقام المتاحة واعتبرها تقديرات. لا تعتذر ولا ترفض.\n\n"
            "أرجع فقط JSON صالح — بدون markdown أو مقدمة.\n"
            "قاعدة بنية حاسمة: لكل معيار، يجب أن تحتوي مصفوفة \"cells\" على عنصر واحد بالضبط لكل مسار، "
            "وبنفس ترتيب مصفوفة \"tracks\" (cells[0] للمسار الأول، cells[1] للمسار الثاني، وهكذا). "
            "لا تدمج مسارين في خلية واحدة ولا تترك أي خلية فارغة.\n\n"
            "{{\n"
            '  "tracks": ["اسم المسار الأول", "اسم المسار الثاني"],\n'
            '  "rows": [\n'
            '    {{\n'
            '      "criterion": "المهارات المطلوبة",\n'
            '      "cells": [\n'
            '        {{"value": "القيمة الخاصة بالمسار الأول", "source": "https://..."}},\n'
            '        {{"value": "القيمة الخاصة بالمسار الثاني", "source": "https://..."}}\n'
            "      ]\n"
            "    }}\n"
            "  ],\n"
            '  "insights": {{\n'
            '    "highest_salary": "اسم المسار",\n'
            '    "fastest_growing": "اسم المسار",\n'
            '    "easiest_to_start": "اسم المسار",\n'
            '    "summary": "ملخص 2-3 جمل"\n'
            "  }}\n"
            "}}"
        ),
        "expected_output": (
            "JSON صالح يقارن المسارات المطلوبة مع رابط مصدر لكل نقطة بيانات وملخص insights."
        ),
    },
}


# ---------------------------------------------------------------------------
# Web search (Serper) + Groq comparison
# ---------------------------------------------------------------------------

def _serper(query: str, num: int = 4) -> list:
    key = os.environ.get("SERPER_API_KEY", "")
    if not key:
        return []
    try:
        resp = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": query, "num": num},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("organic", [])[:num]
    except Exception as exc:
        print(f"[Comparison] Serper error: {exc}")
        return []


def _gather_context(tracks: list, location: str) -> str:
    """Collect real web snippets + source links for each track."""
    blocks = []
    for tr in tracks:
        snips = []
        for q in (
            f"{tr} required skills and qualifications {location}",
            f"{tr} average salary {location}",
            f"{tr} job market demand and growth {location}",
        ):
            for item in _serper(q, 3):
                title = item.get("title", "")
                snippet = item.get("snippet", "")
                link = item.get("link", "")
                if snippet:
                    snips.append(f"- {title}: {snippet} (source: {link})")
        blocks.append(f"### {tr}\n" + ("\n".join(snips[:8]) or "- (no results found; use your best estimate)"))
    return "\n\n".join(blocks)


def run_comparison(tracks_str: str, location: str, currency: str,
                   year: str, criteria_str: str, lang: str = "en") -> str:
    """Produce the structured comparison JSON string (runs entirely on Groq)."""
    from groq import Groq
    cfg = LANG_CONFIG.get(lang, LANG_CONFIG["en"])
    tracks = [t.strip() for t in tracks_str.split(",") if t.strip()]

    context = _gather_context(tracks, location)
    prompt = cfg["task_prompt"].format(
        tracks=tracks_str, location=location, currency=currency,
        year=year, criteria=criteria_str,
    )
    prompt += (
        "\n\n--- WEB SEARCH RESULTS (base your data and sources on these) ---\n"
        f"{context}\n"
        "Use these real results for the values and the source URLs. "
        "If something is missing, give your best estimate and still fill every cell."
    )

    client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
    resp = client.chat.completions.create(
        model=_GROQ_MODEL,
        messages=[
            {"role": "system", "content": (
                "You are an expert career research analyst. You always return valid JSON only, "
                "following the exact structure requested, and you never leave a cell empty."
            )},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content
