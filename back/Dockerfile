# EduPick backend — works on Hugging Face Spaces (Docker), Render, Fly.io, Railway
FROM python:3.11-slim

# System deps some ML wheels need
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code + RAG data
COPY . .

# Pre-download the embedding model so first request isn't slow (optional)
# RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

# Hosts inject $PORT; default 7860 (Hugging Face Spaces convention)
ENV PORT=7860
EXPOSE 7860

CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 180
