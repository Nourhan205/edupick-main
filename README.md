# EduPick 🎓

An AI-powered educational guidance platform that helps students discover the right
career track, build a personalized learning roadmap, quiz themselves, compare tracks,
and chat with an AI study assistant — in English or Arabic.

## Structure

```
back/                                  # Flask API + AI  (deploy = "backend")
  app.py                               # entry point (Flask app = app)
  ai_core / interview_engine / roadmap_agent / comparison_tool / quiz_agent / llms
  data/                                # RAG data (ships with the backend)
  requirements.txt · Procfile · Dockerfile · .env.example
Front/graduation-project--front/       # React + Vite  (deploy = "frontend")
  src/config.js                        # API base URL (VITE_API_URL)
  .env.example · vercel.json
DEPLOYMENT.md                          # step-by-step free hosting guide
```

## Run locally

**Backend**
```bash
cd back
python -m venv venv && venv\Scripts\activate     # Windows
pip install -r requirements.txt
copy .env.example .env                            # fill in keys
python app.py                                     # http://localhost:5000
```

**Frontend**
```bash
cd Front/graduation-project--front
npm install
copy .env.example .env                            # VITE_API_URL=http://localhost:5000
npm run dev                                        # http://localhost:5173
```

## Tech
React (Vite) · Flask · MongoDB · ChromaDB (RAG) · CrewAI · LangChain ·
Groq / OpenRouter / Gemini LLMs.

## Features
Discovery interview · AI roadmaps · topic & career quizzes · career comparison ·
AI assistant (+ floating widget) · personalized dashboard · profile · light/dark themes.
