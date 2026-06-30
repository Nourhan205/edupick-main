import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import '../styles/common.css';
import '../styles/Dashboard.css';

import { API_URL as API } from "../config";

function ProgressRing({ pct, size = 80, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
      <defs>
        <linearGradient id="db-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2F6FED" />
          <stop offset="100%" stopColor="#7DC0FF" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(93,168,245,0.16)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#db-ring-grad)" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size * 0.22} fontWeight="700" style={{ fill: "var(--ep-text)" }}>
        {pct}%
      </text>
    </svg>
  );
}

export default function Dashboard() {
  const navigate  = useNavigate();
  const email     = localStorage.getItem("userEmail") || "";

  const [data,          setData]          = useState(null);
  const [savedRoadmaps, setSavedRoadmaps] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  useEffect(() => {
    if (!email) { setLoading(false); return; }

    const fetchDash = fetch(`${API}/dashboard?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(info => {
        if (info.error) setError(info.error);
        else setData(info);
      })
      .catch(() => setError("Could not load dashboard data."));

    const fetchRoadmaps = fetch(`${API}/roadmap/user?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(info => setSavedRoadmaps(info.roadmaps || []))
      .catch(() => {});

    Promise.all([fetchDash, fetchRoadmaps]).finally(() => setLoading(false));
  }, [email]);

  if (!email) {
    return (
      <div className="db-empty-state">
        <div className="db-empty-card">
          <h2>Welcome to EduPick</h2>
          <p>Log in to see your personalised dashboard — quiz scores, roadmap progress, and recent activity.</p>
          <button className="db-cta-btn" onClick={() => navigate("/login")}>Log in</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="db-loading"><span className="db-spinner" />Loading dashboard…</div>;
  }

  if (error) {
    return <div className="db-error">{error}</div>;
  }

  const {
    username          = "User",
    careerChoices     = 0,
    quizPerformance   = 0,
    roadmapCompleted  = 0,
    totalRoadmaps     = 0,
    activeDays        = 0,
    roadmapPercentage = 0,
    roadmapRemaining  = 0,
    recentActivity    = [],
    chatDays          = [],
    nextTask          = null,
    currentTrack      = "",
    hasInterview      = false,
    hasRoadmap        = false,
    latestRoadmapId   = null,
  } = data || {};

  const openLatestRoadmap = () =>
    latestRoadmapId
      ? navigate("/roadmap", { state: { roadmapId: latestRoadmapId } })
      : navigate("/roadmap");

  // Build actionable "next step" cards from the user's real state
  const actions = [];
  if (!hasInterview) {
    actions.push({
      icon: "🎙️", title: "Discover your track",
      text: "Take the guided interview to get a personalized track recommendation.",
      btn: "Start interview", onClick: () => navigate("/discover"),
    });
  }
  if (!hasRoadmap) {
    actions.push({
      icon: "🗺️", title: "Build your first roadmap",
      text: "Generate a step-by-step learning path tailored to your goal.",
      btn: "Create roadmap", onClick: () => navigate("/roadmap"),
    });
  }
  if (hasRoadmap && roadmapRemaining > 0) {
    actions.push({
      icon: "✅", title: `${roadmapRemaining} task${roadmapRemaining !== 1 ? "s" : ""} left`,
      text: `You're ${roadmapPercentage}% through your ${currentTrack || "roadmap"}. Keep the momentum going!`,
      btn: "Continue roadmap", onClick: openLatestRoadmap,
    });
  }
  if (nextTask) {
    actions.push({
      icon: "🎯", title: "Next up",
      text: nextTask,
      btn: "Quiz this topic", onClick: () => navigate("/test/topic-test", { state: { topic: nextTask } }),
      btn2: "Ask in chat", onClick2: () => navigate("/chatbot"),
    });
  }
  const maxChat = Math.max(1, ...chatDays.map(d => d.count || 0));

  return (
    <div className="db-container">

      {/* ── Header ── */}
      <header className="db-header">
        <div>
          <h2>Welcome back, {username}</h2>
          <p>Your learning progress at a glance</p>
        </div>
        <button className="db-cta-btn" onClick={openLatestRoadmap}>
          {hasRoadmap ? "Open Roadmap →" : "Create Roadmap →"}
        </button>
      </header>

      {/* ── Stat cards ── */}
      <section className="db-stats">
        <div className="db-card db-card--blue db-card--clickable"
             onClick={() => navigate("/test/previous-results")} title="View quiz history">
          <div className="db-card-label">Quiz Attempts</div>
          <div className="db-card-value">{careerChoices}</div>
          <div className="db-card-sub">topic + roadmap quizzes →</div>
        </div>

        <div className="db-card db-card--teal db-card--clickable"
             onClick={() => navigate("/test/previous-results")} title="View quiz history">
          <div className="db-card-label">Avg Quiz Score</div>
          <div className="db-card-value">{quizPerformance}%</div>
          <div className="db-card-sub">across all quizzes →</div>
        </div>

        <div className="db-card db-card--violet">
          <div className="db-card-label">Tasks Done</div>
          <div className="db-card-value">{roadmapCompleted}</div>
          <div className="db-card-sub">in current roadmap</div>
        </div>

        <div className="db-card db-card--green">
          <div className="db-card-label">Active Days</div>
          <div className="db-card-value">{activeDays}</div>
          <div className="db-card-sub">days this week</div>
        </div>
      </section>

      {/* ── Progress ring + bar ── */}
      <section className="db-progress-section">
        <div className="db-progress-ring-wrap">
          <h3>Roadmap Progress</h3>
          <ProgressRing pct={roadmapPercentage} />
          <p>{roadmapCompleted} tasks completed · {totalRoadmaps} roadmap{totalRoadmaps !== 1 ? "s" : ""} saved</p>
        </div>

        <div className="db-progress-bar-wrap">
          <h3>Completion Bar — latest roadmap</h3>
          <div className="db-bar-track">
            <div className="db-bar-fill" style={{ width: `${roadmapPercentage}%` }} />
          </div>
          <p className="db-bar-label">{roadmapPercentage}% of your most recent roadmap completed</p>
        </div>
      </section>

      {/* ── Per-roadmap mini rings (up to 4) ── */}
      {savedRoadmaps.length > 0 && (
        <section className="db-rings-section">
          <h3 className="db-section-heading">All your roadmaps ({savedRoadmaps.length})</h3>
          <div className="db-rings-grid">
            {savedRoadmaps.slice(0, 4).map((rm) => (
              <button
                key={rm.roadmap_id}
                className="db-ring-card"
                onClick={() => navigate("/roadmap", { state: { roadmapId: rm.roadmap_id } })}
                title={`Open ${rm.track}`}
              >
                <ProgressRing pct={rm.progress_pct} size={76} stroke={7} />
                <span className="db-ring-track">{rm.track}</span>
                <span className="db-ring-meta">{rm.phases_count} phases</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Actionable next steps ── */}
      {actions.length > 0 && (
        <section className="db-actions-section">
          <h3 className="db-section-heading">Recommended for you</h3>
          <div className="db-actions-grid">
            {actions.map((a, i) => (
              <div key={i} className="db-action-card">
                <div className="db-action-icon">{a.icon}</div>
                <div className="db-action-body">
                  <h4>{a.title}</h4>
                  <p>{a.text}</p>
                  <div className="db-action-btns">
                    <button className="db-action-btn" onClick={a.onClick}>{a.btn}</button>
                    {a.btn2 && <button className="db-action-btn db-action-btn--ghost" onClick={a.onClick2}>{a.btn2}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Chat activity chart ── */}
      <section className="db-chart-section">
        <h3 className="db-section-heading">Chat activity — last 7 days</h3>
        <div className="db-chart-card">
          {chatDays.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chatDays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#6B82A8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#6B82A8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(47,111,237,0.08)" }}
                  contentStyle={{ background: "#0E1E3A", border: "1px solid rgba(120,170,240,0.26)", borderRadius: 10, color: "#EAF1FF" }}
                  labelStyle={{ color: "#A7BCDE" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {chatDays.map((d, i) => (
                    <Cell key={i} fill={d.count === maxChat && maxChat > 0 ? "#5DA8F5" : "#2F6FED"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="db-empty-text">No chat activity yet. Ask the AI assistant a question to start your streak.</p>
          )}
        </div>
      </section>

      {/* ── Recent activity ── */}
      <section className="db-activity">
        <h3>Recent Activity</h3>
        {recentActivity.length > 0 ? (
          <ul className="db-activity-list">
            {recentActivity.map((item, i) => (
              <li key={i} className="db-activity-item">
                <span className="db-activity-dot" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="db-empty-text">
            No activity yet. Take the quiz or generate a roadmap to get started.
          </p>
        )}
      </section>

      {/* ── Saved roadmaps ── */}
      <section className="db-roadmaps">
        <h3>Saved Roadmaps</h3>
        {savedRoadmaps.length > 0 ? (
          <div className="db-roadmap-grid">
            {savedRoadmaps.map((rm) => (
              <div key={rm.roadmap_id} className="db-roadmap-card">
                <div className="db-roadmap-track">{rm.track}</div>
                <div className="db-roadmap-meta">
                  {rm.phases_count} phases · saved {new Date(rm.created_at).toLocaleDateString()}
                </div>
                <div className="db-roadmap-bar-wrap">
                  <div className="db-roadmap-bar">
                    <div className="db-roadmap-bar-fill" style={{ width: `${rm.progress_pct}%` }} />
                  </div>
                  <span>{rm.progress_pct}%</span>
                </div>
                <button
                  className="db-roadmap-open-btn"
                  onClick={() => navigate("/roadmap", { state: { roadmapId: rm.roadmap_id } })}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="db-empty-text">
            No roadmaps saved yet.{" "}
            <button className="db-link-btn" onClick={() => navigate("/roadmap")}>
              Generate one now →
            </button>
          </p>
        )}
      </section>

    </div>
  );
}
