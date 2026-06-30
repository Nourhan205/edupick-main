
import os
import re
import json
import time
from typing import Optional

from groq import Groq


class TopicDetector:
    """Maps a user question to a roadmap topic using semantic similarity."""

    def __init__(self, roadmap_topics, topic_ids=None, similarity_threshold=0.75):
        from sentence_transformers import SentenceTransformer, util
        self._util = util
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.topics = roadmap_topics
        self.topic_ids = topic_ids or [f"topic_{i}" for i in range(len(roadmap_topics))]
        self.topic_embeddings = self.model.encode(self.topics, convert_to_tensor=True)
        self.threshold = similarity_threshold

    def detect_topic(self, user_query):
        import torch
        query_embedding = self.model.encode(user_query, convert_to_tensor=True)
        similarities = self._util.cos_sim(query_embedding, self.topic_embeddings)[0]
        best_idx = torch.argmax(similarities).item()
        best_score = similarities[best_idx].item()

        if best_score >= self.threshold:
            return {
                "topic_id": self.topic_ids[best_idx],
                "topic_name": self.topics[best_idx],
                "confidence": round(best_score, 3),
                "status": "matched",
            }
        return {
            "topic_id": None,
            "topic_name": None,
            "confidence": round(best_score, 3),
            "status": "out_of_scope",
        }


class ContextBuilder:
    """Merges topic detection + user progress + roadmap relations into one context dict."""

    def __init__(self, roadmap_data, user_db_client):
        self.roadmap = roadmap_data
        self.db = user_db_client

    def build(self, user_id, detection_result):
        user_progress = self.db.get_progress(user_id)

        current_level = user_progress.get("level", "beginner")
        completed_topics = user_progress.get("completed", [])
        struggling_flags = user_progress.get("struggling_with", [])

        topic_relations = {}
        if detection_result["status"] == "matched" and detection_result["topic_id"]:
            topic_relations = self.roadmap.get(
                detection_result["topic_id"],
                {"prerequisites": [], "next_topics": [], "resources": []},
            )

        return {
            "detected_topic": detection_result,
            "user_state": {
                "current_level": current_level,
                "completed_topics": completed_topics,
                "struggling_with": struggling_flags,
            },
            "roadmap_relations": topic_relations,
            "decision_hint": None,
        }


class DecisionRules:
    """Sets a decision_hint (explain_concept / suggest_review / suggest_next / ...) based on rules, not AI guessing."""

    def __init__(self, repeat_question_threshold=3, time_window_seconds=300, confidence_high=0.75):
        self.repeat_threshold = repeat_question_threshold
        self.time_window = time_window_seconds
        self.confidence_high = confidence_high

    def apply(self, context, detection_result, recent_questions=None):
        user_state = context["user_state"]
        roadmap = context["roadmap_relations"]

        completed = user_state.get("completed_topics", [])
        struggling = user_state.get("struggling_with", [])

        detected_topic_id = detection_result.get("topic_id")
        detected_status = detection_result.get("status")
        detected_confidence = detection_result.get("confidence", 0)

        if detected_status == "out_of_scope":
            context["decision_hint"] = "general_answer"
            context["clarification_prompt"] = (
                "This question is outside your current learning path. "
                "Would you like a general explanation, or shall we focus on your roadmap?"
            )
            return context

        if detected_status == "matched" and detected_topic_id:
            prereqs = roadmap.get("prerequisites", [])
            missing_prereqs = [p for p in prereqs if p not in completed]
            if missing_prereqs:
                context["decision_hint"] = "warn_prerequisites"
                context["suggested_review"] = missing_prereqs[:2]
                context["message_override"] = (
                    f"Before diving into {detected_topic_id}, let's quickly review: "
                    f"{', '.join(missing_prereqs[:2])}"
                )
                return context

        if recent_questions and detected_topic_id:
            now = time.time()
            recent_same_topic = [
                q for q in recent_questions
                if q.get("topic_id") == detected_topic_id
                and (now - q.get("timestamp", 0)) < self.time_window
            ]
            if len(recent_same_topic) >= self.repeat_threshold:
                context["decision_hint"] = "suggest_review"
                context["review_resources"] = roadmap.get("resources", [])[:3]
                context["message_override"] = (
                    "It seems this topic needs a bit more practice. "
                    "Let me break it down differently + here are some helpful resources."
                )
                return context

        if detected_topic_id and detected_topic_id in struggling:
            context["decision_hint"] = "suggest_review"
            context["review_resources"] = roadmap.get("resources", [])[:3]
            context["message_override"] = "Let's revisit this with a simpler explanation + examples."
            return context

        if detected_topic_id and detected_topic_id in completed:
            next_topics = roadmap.get("next_topics", [])
            if next_topics and detected_confidence >= self.confidence_high:
                context["decision_hint"] = "suggest_next"
                context["suggested_next"] = next_topics[:2]
                context["message_override"] = f"Great progress! You're ready to move on to: {next_topics[0]}"
                return context

        context["decision_hint"] = "explain_concept"
        return context


class ContextEngine:
    """Combines TopicDetector + ContextBuilder + DecisionRules into one call."""

    def __init__(self, roadmap_data, db_client, topic_names, topic_ids):
        self.detector = TopicDetector(topic_names, topic_ids)
        self.builder = ContextBuilder(roadmap_data, db_client)
        self.rules = DecisionRules()
        self.cache = {}

    def get_context(self, user_id, user_query):
        detection = self.detector.detect_topic(user_query)
        context = self.builder.build(user_id, detection)
        recent = self.cache.get(user_id, [])
        final = self.rules.apply(context, detection, recent)
        self._update_cache(user_id, detection.get("topic_id"))
        return final

    def _update_cache(self, user_id, topic_id, max_items=10):
        self.cache.setdefault(user_id, [])
        self.cache[user_id].append({"topic_id": topic_id, "timestamp": time.time()})
        self.cache[user_id] = self.cache[user_id][-max_items:]


class PromptBuilder:
    """Turns a context dict into a system + user prompt that forces a structured JSON answer."""

    SYSTEM_TEMPLATE = """You are EduPick AI — a smart educational assistant that helps students learn programming, technology, and any academic topic.

## Core Role
- Answer ANY educational or technical question thoroughly and clearly.
- You are NOT limited to the student's roadmap — any topic is fair game.
- Tailor your explanation depth to the student's level.
- Use examples, analogies, and code snippets where they help.
- CRITICAL: Always reply in the SAME language the student used.
  If they write in Arabic → answer fully in Arabic.
  If they write in English → answer in English.
  The "answer" field and "suggestions" must both be in the student's language.

## Student Context (use to personalize, not to restrict)
- Level: {level}
- Completed topics: {completed}
- Current focus area: {topic_name}
- What comes next in their roadmap: {next_topics}
- Struggling with: {struggling}

## Response Guidelines
{behavior_rules}

## Response Format (REQUIRED — JSON only)
You MUST respond with ONLY valid JSON — no markdown fences, no text outside the object.

{{
  "answer": "<complete helpful explanation — use numbered steps, ```language code blocks, bullet lists as needed>",
  "related_topic": "<topic this question relates to, or null>",
  "suggestions": ["<follow-up phrase 1>", "<follow-up phrase 2>", "<follow-up phrase 3>"]
}}

Suggestion rules:
- SHORT follow-up questions or action phrases (max 8 words each)
- Make them genuinely useful next steps
- Always give exactly 3 suggestions
"""

    BEHAVIOR_RULES = {
        "explain_concept": (
            "- Give a complete, well-structured explanation.\n"
            "- Start with a simple analogy or real-world comparison, then go deeper.\n"
            "- Include code examples in the relevant language when useful.\n"
            "- End with a concise summary sentence."
        ),
        "suggest_review": (
            "- The student is struggling — be extra patient and supportive.\n"
            "- Break the concept down into the smallest possible steps.\n"
            "- Use a very simple real-world analogy before any code.\n"
            "- Acknowledge that it's a common challenge and validate their effort."
        ),
        "suggest_next": (
            "- The student has already covered this topic — acknowledge their progress.\n"
            "- Give a quick confident recap of the key points.\n"
            "- Naturally bridge to the next related concept or skill."
        ),
        "warn_prerequisites": (
            "- Briefly note that some background knowledge would help.\n"
            "- Still give a complete, useful answer — never refuse.\n"
            "- Suggest the prerequisite topic as a follow-up, not a blocker."
        ),
        "general_answer": (
            "- Give a thorough, complete answer — this is a great general question.\n"
            "- Don't limit yourself: explain the concept fully with examples.\n"
            "- If it naturally connects to the student's learning focus, mention it briefly."
        ),
    }

    def build(self, user_query: str, context: Optional[dict]):
        context = context or {}

        user_state = context.get("user_state", {})
        roadmap = context.get("roadmap_relations", {})
        detected = context.get("detected_topic", {})
        decision = context.get("decision_hint") or "explain_concept"

        level = user_state.get("current_level", "beginner")
        completed = user_state.get("completed_topics", [])
        struggling = user_state.get("struggling_with", [])
        topic_name = detected.get("topic_name") or "general programming"
        prerequisites = roadmap.get("prerequisites", [])
        next_topics = roadmap.get("next_topics", [])

        behavior = self.BEHAVIOR_RULES.get(decision, self.BEHAVIOR_RULES["explain_concept"])

        override_hint = ""
        if context.get("message_override"):
            override_hint = f"\n\n[Instructor hint for tone: {context['message_override']}]"

        system_prompt = self.SYSTEM_TEMPLATE.format(
            level=level,
            completed=", ".join(completed) if completed else "none yet",
            struggling=", ".join(struggling) if struggling else "none",
            topic_name=topic_name,
            prerequisites=", ".join(prerequisites) if prerequisites else "none",
            next_topics=", ".join(next_topics) if next_topics else "none defined yet",
            behavior_rules=behavior,
        )

        user_message = f"Student question: {user_query}{override_hint}"
        return system_prompt, user_message


class GroqAPIError(Exception):
    pass


class GroqAPIClient:
    MODEL = "llama-3.3-70b-versatile"

    def __init__(self, api_key=None):
        key = api_key or os.environ.get("GROQ_API_KEY")
        if not key:
            raise GroqAPIError(
                "No API key found. Create one from https://console.groq.com "
                "and set it as GROQ_API_KEY in your .env file."
            )
        self.client = Groq(api_key=key)

    def call(self, system_prompt: str, user_message: str, history: list = None) -> str:
        messages = [{"role": "system", "content": system_prompt}]

        for msg in (history or []):
            role    = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_message})

        try:
            response = self.client.chat.completions.create(
                model=self.MODEL,
                messages=messages,
                temperature=0.4,
                max_tokens=1000,
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise GroqAPIError(f"Groq API error: {e}") from e


class ResponseParseError(Exception):
    pass


class ResponseParser:
    """Extracts and validates the structured JSON from the model's raw output."""

    REQUIRED_KEYS = {"answer", "related_topic", "suggestions"}

    def parse(self, raw_text: str) -> dict:
        cleaned = self._strip_fences(raw_text)
        json_str = self._extract_json(cleaned)
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            raise ResponseParseError(f"Invalid JSON from model: {e}\nRaw: {raw_text[:300]}") from e
        return self._validate(data)

    def _strip_fences(self, text: str) -> str:
        text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text.strip())
        return text.strip()

    def _extract_json(self, text: str) -> str:
        start = text.find("{")
        if start == -1:
            raise ResponseParseError(f"No JSON object found in: {text[:200]}")
        depth, end = 0, -1
        for i, ch in enumerate(text[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end == -1:
            raise ResponseParseError("Unbalanced JSON braces in response.")
        return text[start:end]

    def _validate(self, data: dict) -> dict:
        if "answer" not in data or not isinstance(data["answer"], str):
            raise ResponseParseError("Missing or invalid 'answer' field.")

        if "related_topic" not in data:
            data["related_topic"] = None

        sugg = data.get("suggestions", [])
        if not isinstance(sugg, list):
            sugg = []
        sugg = [str(s) for s in sugg if s][:3]
        while len(sugg) < 3:
            sugg.append("Explain it differently")
        data["suggestions"] = sugg

        return {
            "answer": data["answer"],
            "related_topic": data["related_topic"],
            "suggestions": data["suggestions"],
        }


class FallbackHandler:
    """Returns a safe, friendly response when anything goes wrong."""

    @staticmethod
    def api_error(user_query: str) -> dict:
        return {
            "answer": (
                "I'm having a bit of trouble connecting right now. "
                f'Could you try again in a moment? Your question was noted: "{user_query}"'
            ),
            "related_topic": None,
            "suggestions": ["Try asking again", "Rephrase the question", "Ask something simpler first"],
        }

    @staticmethod
    def parse_error(raw_text: str) -> dict:
        clean = re.sub(r"[{}\[\]\"']", "", raw_text)[:800]
        return {
            "answer": clean.strip() or "Sorry, I could not format my answer properly. Please try again.",
            "related_topic": None,
            "suggestions": ["Ask the question again", "Try a different phrasing", "Ask for a simpler explanation"],
        }


class AICore:
    """
    Main entry point used by the Flask route.

    Usage:
        ai = AICore()  # reads GROQ_API_KEY from environment
        result = ai.generate_response(user_query, context)  # context can be None for now
        # result = {"answer": "...", "related_topic": "...", "suggestions": ["...", "...", "..."]}
    """

    def __init__(self, api_key: Optional[str] = None):
        self.prompt_builder = PromptBuilder()
        self.api_client = GroqAPIClient(api_key=api_key)
        self.response_parser = ResponseParser()
        self.fallback = FallbackHandler()

    def generate_response(
        self,
        user_query: str,
        context: Optional[dict] = None,
        history: Optional[list] = None,
    ) -> dict:
        system_prompt, user_message = self.prompt_builder.build(user_query, context)

        try:
            raw_text = self.api_client.call(system_prompt, user_message, history=history)
        except GroqAPIError as e:
            print(f"[AICore] API error: {e}")
            return self.fallback.api_error(user_query)

        try:
            return self.response_parser.parse(raw_text)
        except ResponseParseError as e:
            print(f"[AICore] Parse error: {e}")
            return self.fallback.parse_error(raw_text)
