"""
Unified multi-provider LLM factory for EduPick.

Usage:
    from llms import llm_grok, llm_4m, llm_flash   # OpenRouter presets
    from llms import groq_llm, gemini_llm            # Named providers
    from llms import make_openrouter, make_groq      # Custom instances

Env vars required (in .env):
    OPENROUTER_API_KEY   — https://openrouter.ai/keys
    GROQ_API_KEY         — https://console.groq.com
"""

import os
from dotenv import load_dotenv

load_dotenv()


def make_openrouter(model: str, temp: float = 0.3):
    """Create a LangChain ChatOpenAI instance pointed at OpenRouter."""
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=model,
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=os.environ.get("OPENROUTER_API_KEY", ""),
        temperature=temp,
    )


def make_groq(model: str = "llama-3.3-70b-versatile", temp: float = 0.3):
    """Create a LangChain ChatGroq instance."""
    from langchain_groq import ChatGroq
    return ChatGroq(
        model=model,
        api_key=os.environ.get("GROQ_API_KEY", ""),
        temperature=temp,
    )


def make_gemini(model: str = "gemini-2.0-flash", temp: float = 0.3):
    """Create a LangChain ChatGoogleGenerativeAI instance."""
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=os.environ.get("GEMINI_API_KEY", ""),
        temperature=temp,
    )


def make_crew_llm(model: str, temp: float = 0.3):
    """
    Create a CrewAI-native LLM (litellm-based) pointed at OpenRouter.

    CrewAI Agents do NOT accept LangChain chat models — they need a crewai.LLM.
    litellm routes via the `openrouter/` model prefix.
    """
    from crewai import LLM
    return LLM(
        model=f"openrouter/{model}",
        api_key=os.environ.get("OPENROUTER_API_KEY", ""),
        base_url="https://openrouter.ai/api/v1",
        temperature=temp,
    )


def make_crew_groq(model: str = "llama-3.3-70b-versatile", temp: float = 0.3):
    """Create a CrewAI LLM pointed at Groq (via litellm's `groq/` provider)."""
    from crewai import LLM
    return LLM(
        model=f"groq/{model}",
        api_key=os.environ.get("GROQ_API_KEY", ""),
        temperature=temp,
    )


# ---------------------------------------------------------------------------
# Central model registry — change a model name in ONE place.
# The plain-Groq pipelines (roadmap_agent, cv_analyzer, comparison_tool) read
# these. To switch a model later, just edit the string here (or set the env var).
# ---------------------------------------------------------------------------
GROQ_MODEL        = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
ROADMAP_MODEL     = os.environ.get("ROADMAP_MODEL",  GROQ_MODEL)
CV_ANALYZER_MODEL = os.environ.get("CV_ANALYZER_MODEL", GROQ_MODEL)


def groq_client():
    """Return a raw `groq.Groq` client (or None if the key/SDK is missing).

    Used by the plain-Groq pipelines that call the API directly with JSON mode,
    instead of going through LangChain/CrewAI.
    """
    try:
        from groq import Groq
        key = os.environ.get("GROQ_API_KEY", "")
        return Groq(api_key=key) if key else None
    except Exception:
        return None


# Shorthand alias used in user's pattern
_or = make_openrouter

# ---------------------------------------------------------------------------
# Pre-built tier instances
# ---------------------------------------------------------------------------

# Tier 1 — Powerful (reasoning, complex generation)
llm_grok = _or("x-ai/grok-4",                    temp=0.2)

# Tier 2 — Balanced (general tasks, roadmap, quiz)
llm_4m   = _or("openai/gpt-4.1-mini",            temp=0.3)

# Tier 3 — Fast / cheap (SEO queries, keywords, routing)
llm_flash = _or("google/gemini-2.5-flash-lite",   temp=0.3)

# Named provider shortcuts
groq_llm   = make_groq("llama-3.3-70b-versatile", temp=0.3)
gemini_llm = make_groq("llama-3.3-70b-versatile", temp=0.3)  # Groq fallback (no Gemini billing)

# ---------------------------------------------------------------------------
# CrewAI-native LLMs (for Agents — roadmap_agent, comparison_tool)
# LangChain chat models are NOT compatible with crewai.Agent(llm=...)
# ---------------------------------------------------------------------------
crew_llm_4m    = make_crew_llm("openai/gpt-4.1-mini",          temp=0.3)
crew_llm_flash = make_crew_llm("google/gemini-2.5-flash-lite", temp=0.3)

# CrewAI LLM on Groq (currently the default for all agents — keep the
# OpenRouter/Gemini ones above for switching back later).
crew_llm_groq  = make_crew_groq("llama-3.3-70b-versatile",     temp=0.3)
