import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/MainTest.css";
import "../styles/PreviousResults.css";

import { API_URL } from "../config";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-EG", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso; }
}

export default function PreviousResults() {
  const navigate = useNavigate();
  const email    = localStorage.getItem("userEmail") || "";

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [filter,  setFilter]  = useState("all"); // all | topic | roadmap

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    fetch(`${API_URL}/topic-quiz/results?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setResults(data.results || []);
      })
      .catch(e => setError(e.message || "Failed to load results."))
      .finally(() => setLoading(false));
  }, [email]);

  // ── Not logged in ──
  if (!email) return (
    <div className="ep-page"><PageHeader />
      <main className="ep-main">
        <div className="ep-card pr-empty-card">
          <div className="pr-empty-icon">🔒</div>
          <h3>Sign in to see your results</h3>
          <p>Your quiz results are saved to your account. Log in to access them.</p>
          <button className="ep-btn ep-btn-primary" onClick={() => navigate("/login")}>Go to Login</button>
        </div>
      </main>
    </div>
  );

  if (loading) return (
    <div className="ep-page"><PageHeader />
      <main className="ep-main">
        <div className="ep-card pr-empty-card"><span className="ep-spinner pr-spinner" /><p>Loading your results…</p></div>
      </main>
    </div>
  );

  if (error) return (
    <div className="ep-page"><PageHeader />
      <main className="ep-main">
        <div className="ep-card pr-empty-card"><div className="pr-empty-icon">⚠️</div><p className="ep-error">{error}</p></div>
      </main>
    </div>
  );

  if (!results.length) return (
    <div className="ep-page"><PageHeader />
      <main className="ep-main">
        <div className="ep-card pr-empty-card">
          <div className="pr-empty-icon">📋</div>
          <h3>No quiz results yet</h3>
          <p>Take a quiz from your roadmap (topic or per-phase) and your scores will appear here.</p>
          <button className="ep-btn ep-btn-primary" onClick={() => navigate("/test/topic-test")}>Take a Quiz</button>
        </div>
      </main>
    </div>
  );

  const shown = results.filter(r =>
    filter === "all" ? true : (r.source || "topic") === filter
  );
  const avg = results.length
    ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length)
    : 0;

  return (
    <div className="ep-page"><PageHeader />
      <main className="pr-main">
        <div className="pr-container">

          <div className="pr-page-title">
            <h2>Your Quiz History</h2>
            <p>{results.length} result{results.length !== 1 ? "s" : ""} · average {avg}%</p>
          </div>

          <div className="pr-filters">
            {["all", "topic", "roadmap"].map(f => (
              <button
                key={f}
                className={`pr-filter${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "topic" ? "Topic quizzes" : "Roadmap quizzes"}
              </button>
            ))}
          </div>

          <div className="pr-list">
            {shown.map((item, idx) => {
              const pct = item.percentage ?? 0;
              const isRoadmap = (item.source || "topic") === "roadmap";
              return (
                <div key={idx} className="pr-card">
                  <div className="pr-card-header pr-card-header--static">
                    <div className="pr-card-left">
                      <span className="pr-card-emoji">{isRoadmap ? "🗺️" : "📝"}</span>
                      <div>
                        <span className="pr-card-track">{item.test_name || item.topic}</span>
                        <span className="pr-card-date">
                          <span className={`pr-tag ${isRoadmap ? "pr-tag--rm" : "pr-tag--tp"}`}>
                            {isRoadmap ? "Roadmap quiz" : "Topic quiz"}
                          </span>
                          {item.track ? ` · ${item.track}` : ""} · {formatDate(item.submitted_at)}
                        </span>
                      </div>
                    </div>
                    <div className="pr-card-right">
                      <div className="pr-mini-bar-wrap"><div className="pr-mini-bar" style={{ width: `${pct}%` }} /></div>
                      <span className="pr-card-pct">{pct}%</span>
                      <span className="pr-card-fraction">{item.score}/{item.total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pr-footer">
            <button className="ep-btn ep-btn-primary" onClick={() => navigate("/test/topic-test")}>Take Another Quiz</button>
          </div>

        </div>
      </main>
    </div>
  );
}

function PageHeader() {
  const navigate = useNavigate();
  return (
    <header className="ep-header">
      <div className="ep-logo" style={{ cursor: "pointer" }} onClick={() => navigate("/test")}>EduPick</div>
      <span className="ep-tagline">Previous Results</span>
    </header>
  );
}
