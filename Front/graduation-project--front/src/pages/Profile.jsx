import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserCircle, FaRoute, FaClipboardList, FaMapSigns,
  FaMicrophone, FaGraduationCap, FaBriefcase,
} from "react-icons/fa";
import "../styles/Profile.css";
import { ReportView } from "./TrackDiscovery";

import { API_URL as API } from "../config";

const STATUS_LABEL = {
  student: "Student",
  graduate: "Graduate",
};
const LEVEL_LABEL = {
  high_school: "High School",
  college: "College",
};

export default function Profile() {
  const navigate = useNavigate();
  const email = localStorage.getItem("userEmail") || "";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    fetch(`${API}/profile?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  }, [email]);

  if (!email) return (
    <div className="pf-empty">
      <div className="pf-empty-card">
        <FaUserCircle className="pf-empty-icon" />
        <h2>Sign in to view your profile</h2>
        <button className="ep-btn ep-btn-primary" onClick={() => navigate("/login")}>Log in</button>
      </div>
    </div>
  );

  if (loading) return <div className="pf-loading"><div className="ep-spinner" /><p>Loading your profile…</p></div>;
  if (!data)   return <div className="pf-loading"><p>Could not load profile.</p></div>;

  const { name, age, status, study_level, suggested_track,
          suggested_colleges = [], roadmaps = [], quizzes = [],
          topic_quizzes = [], interview } = data;
  const colleges = suggested_colleges.length ? suggested_colleges : (interview?.suggested_colleges || []);

  const initials = (name || email).slice(0, 2).toUpperCase();

  return (
    <div className="pf-page">

      {/* Hero */}
      <header className="pf-hero">
        <div className="pf-avatar">{initials}</div>
        <div className="pf-hero-info">
          <h1>{name || "Your Profile"}</h1>
          <p className="pf-email">{email}</p>
          <div className="pf-badges">
            {age && <span className="pf-badge">🎂 {age} yrs</span>}
            {status && (
              <span className="pf-badge">
                {status === "graduate" ? <FaBriefcase /> : <FaGraduationCap />} {STATUS_LABEL[status] || status}
              </span>
            )}
            {study_level && <span className="pf-badge">🏫 {LEVEL_LABEL[study_level] || study_level}</span>}
            {suggested_track && <span className="pf-badge pf-badge--accent"><FaRoute /> {suggested_track}</span>}
          </div>
        </div>
      </header>

      {/* Quick stats */}
      <section className="pf-stats">
        <StatTile icon={<FaMapSigns />}      value={roadmaps.length}      label="Roadmaps" />
        <StatTile icon={<FaClipboardList />} value={quizzes.length}       label="Career Quizzes" />
        <StatTile icon={<FaClipboardList />} value={topic_quizzes.length} label="Topic Tests" />
        <StatTile icon={<FaMicrophone />}    value={interview ? 1 : 0}    label="Interviews" />
      </section>

      <div className="pf-grid">

        {/* Chosen track / interview */}
        <section className="pf-card">
          <h3><FaRoute /> Chosen Track</h3>
          {suggested_track ? (
            <>
              <p className="pf-track-name">{suggested_track}</p>
              <p className="pf-muted">Recommended from your Track Discovery interview.</p>
              <button className="ep-btn ep-btn-primary pf-w" onClick={() => navigate("/roadmap", { state: { suggestedTrack: suggested_track } })}>
                Build a roadmap for it →
              </button>
            </>
          ) : (
            <>
              <p className="pf-muted">You haven't chosen a track yet. Take the discovery interview to get a personalized recommendation.</p>
              <button className="ep-btn ep-btn-ghost pf-w" onClick={() => navigate("/discover")}>Start interview</button>
            </>
          )}
        </section>

        {/* Recommended colleges */}
        {colleges.length > 0 && (
          <section className="pf-card">
            <h3><FaGraduationCap /> Recommended Colleges</h3>
            <div className="pf-list">
              {colleges.map((c, i) => (
                <div key={i} className="pf-row pf-row--static">
                  <span className="pf-row-title">{c.name || c.department}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Roadmaps */}
        <section className="pf-card">
          <h3><FaMapSigns /> My Roadmaps</h3>
          {roadmaps.length ? (
            <div className="pf-list">
              {roadmaps.map(rm => (
                <button key={rm.roadmap_id} className="pf-row" onClick={() => navigate("/roadmap", { state: { roadmapId: rm.roadmap_id } })}>
                  <div>
                    <span className="pf-row-title">{rm.track}</span>
                    <span className="pf-row-sub">{rm.level} · {new Date(rm.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="pf-row-pct">
                    <div className="pf-mini-bar"><div style={{ width: `${rm.progress_pct}%` }} /></div>
                    <span>{rm.progress_pct}%</span>
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="pf-muted">No roadmaps yet.</p>}
        </section>

        {/* Career quizzes */}
        <section className="pf-card">
          <h3><FaClipboardList /> Career Quiz Results</h3>
          {quizzes.length ? (
            <div className="pf-list">
              {quizzes.map((q, i) => (
                <div key={i} className="pf-row pf-row--static">
                  <span className="pf-row-title">{q.top_track}</span>
                  <span className="pf-chip">{q.match_pct}% match</span>
                </div>
              ))}
            </div>
          ) : <p className="pf-muted">No career quizzes taken yet.</p>}
        </section>

        {/* Topic tests */}
        <section className="pf-card">
          <h3><FaClipboardList /> Topic Tests</h3>
          {topic_quizzes.length ? (
            <div className="pf-list">
              {topic_quizzes.map((q, i) => (
                <div key={i} className="pf-row pf-row--static">
                  <span className="pf-row-title">{q.test_name || q.topic}</span>
                  <span className="pf-chip">{q.score}/{q.total} · {q.percentage}%</span>
                </div>
              ))}
            </div>
          ) : <p className="pf-muted">No topic tests yet.</p>}
        </section>

        {/* Interview report */}
        {interview && (
          <section className="pf-card pf-card--wide">
            <h3><FaMicrophone /> Interview Report</h3>
            {interview.suggested_tracks?.length > 0 && (
              <div className="pf-track-chips">
                {interview.suggested_tracks.map((t, i) => (
                  <button key={i} className="pf-track-chip" onClick={() => navigate("/roadmap", { state: { suggestedTrack: t.name } })}>
                    <FaRoute /> {t.name}
                  </button>
                ))}
              </div>
            )}
            <div className="pf-report"><ReportView report={interview.report} /></div>
          </section>
        )}

      </div>
    </div>
  );
}

function StatTile({ icon, value, label }) {
  return (
    <div className="pf-stat">
      <div className="pf-stat-icon">{icon}</div>
      <div className="pf-stat-value">{value}</div>
      <div className="pf-stat-label">{label}</div>
    </div>
  );
}
