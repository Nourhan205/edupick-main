// Central API base URL.
// In development it falls back to the local Flask server.
// In production set VITE_API_URL (e.g. https://your-backend.onrender.com) at build time.
export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
