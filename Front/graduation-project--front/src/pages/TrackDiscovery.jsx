import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaRobot,
  FaUserCircle,
  FaPaperPlane,
  FaGraduationCap,
  FaRoute,
  FaCheckCircle,
  FaArrowRight,
  FaSpinner,
} from "react-icons/fa";
import "../styles/TrackDiscovery.css";

import { API_URL } from "../config";

// ─── Stages ────────────────────────────────────────────────
// "intro"     → name + path-type selection
// "interview" → Q&A chat
// "analyzing" → loading spinner while backend processes
// "result"    → final report + CTA

export default function TrackDiscovery() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  // ── Stage control ─────────────────────────────────────────
  const [stage, setStage] = useState("intro");

  // ── Intro form ────────────────────────────────────────────
  const [userName, setUserName]   = useState(localStorage.getItem("userName") || "");
  const [pathType, setPathType]   = useState(null); // "track_only" | "college_and_track"
  const [introError, setIntroError] = useState("");
  const email = localStorage.getItem("userEmail") || "";

  // ── Interview chat ────────────────────────────────────────
  const [sessionId,    setSessionId]    = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [qNumber,      setQNumber]      = useState(0);
  const [totalQ,       setTotalQ]       = useState(4);
  const [chatLoading,  setChatLoading]  = useState(false);

  // ── Result ────────────────────────────────────────────────
  const [result, setResult] = useState(null);

  // auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stage]);

  // Prefill the name from the account if it isn't already known
  useEffect(() => {
    if (!email || userName) return;
    fetch(`${API_URL}/profile?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { if (d.name) setUserName(d.name); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // ── Start session ─────────────────────────────────────────
  const handleStart = async () => {
    if (!userName.trim()) {
      setIntroError("Please enter your name.");
      return;
    }
    if (!pathType) {
      setIntroError("Please select a path.");
      return;
    }
    setIntroError("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: userName, path_type: pathType, email }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setIntroError(data.error || "Failed to start session.");
        return;
      }

      setSessionId(data.session_id);
      setQNumber(data.question_number);
      setTotalQ(data.total_questions);
      setMessages([{ type: "bot", text: data.question }]);
      setStage("interview");
    } catch {
      setIntroError("Could not reach the server. Is the backend running?");
    } finally {
      setChatLoading(false);
    }
  };

  // ── Submit answer ─────────────────────────────────────────
  const handleAnswer = async () => {
    const answer = input.trim();
    if (!answer || chatLoading) return;

    setMessages((prev) => [...prev, { type: "user", text: answer }]);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, answer }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { type: "bot", text: `Error: ${data.error}` },
        ]);
        return;
      }

      if (data.done) {
        // Transition to analyzing → then result
        setStage("analyzing");
        setTimeout(() => {
          setResult(data.result);
          setStage("result");
        }, 800);
      } else {
        setQNumber(data.question_number);
        setMessages((prev) => [...prev, { type: "bot", text: data.question }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: "Couldn't reach the server. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Navigate to roadmap with pre-filled track ─────────────
  const handleCreateRoadmap = (track) => {
    navigate("/roadmap", {
      state: {
        suggestedTrack: track || result?.suggested_track,
        suggestedTracks: result?.suggested_tracks || [],
        fromInterview: true,
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  if (stage === "intro") return <IntroScreen {...{ userName, setUserName, pathType, setPathType, introError, chatLoading, handleStart }} />;
  if (stage === "analyzing") return <AnalyzingScreen userName={userName} />;
  if (stage === "result") return <ResultScreen result={result} handleCreateRoadmap={handleCreateRoadmap} />;

  // ── Interview chat UI ──────────────────────────────────────
  return (
    <div className="td-page">
      {/* Header */}
      <div className="td-header">
        <div className="td-brand">
          <FaRobot className="td-brand-icon" />
          <div>
            <h2>Track Discovery</h2>
            <span>Career &amp; Academic Guidance</span>
          </div>
        </div>
        <div className="td-progress-badge">
          Question {qNumber} / {totalQ}
        </div>
      </div>

      {/* Progress bar */}
      <div className="td-progress-bar">
        <div
          className="td-progress-fill"
          style={{ width: `${(qNumber / totalQ) * 100}%` }}
        />
      </div>

      {/* Messages */}
      <div className="td-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`td-message td-${msg.type}`}>
            <div className="td-avatar">
              {msg.type === "bot" ? <FaRobot /> : <FaUserCircle />}
            </div>
            <div className="td-bubble">
              <p>{msg.text}</p>
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="td-message td-bot">
            <div className="td-avatar"><FaRobot /></div>
            <div className="td-bubble td-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="td-input-area">
        <div className="td-input-wrapper">
          <input
            value={input}
            placeholder={`Your answer, ${userName}...`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnswer()}
            disabled={chatLoading}
          />
          <button className="td-send-btn" onClick={handleAnswer} disabled={chatLoading}>
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-screens ────────────────────────────────────────────

function IntroScreen({ userName, setUserName, pathType, setPathType, introError, chatLoading, handleStart }) {
  return (
    <div className="td-intro-page">
      <div className="td-intro-card">
        <div className="td-intro-icon-wrap">
          <FaGraduationCap className="td-intro-icon" />
        </div>
        <h1>Track Discovery</h1>
        <p className="td-intro-sub">
          A short guided interview to recommend the best career track or university
          department based on your interests and skills.
        </p>

        <div className="td-intro-form">
          <label>Your name</label>
          <input
            type="text"
            placeholder="e.g. Ahmed"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
          />

          <label>What are you looking for?</label>
          <div className="td-path-options">
            <button
              className={`td-path-btn ${pathType === "track_only" ? "active" : ""}`}
              onClick={() => setPathType("track_only")}
            >
              <FaRoute className="td-path-icon" />
              <span>Training Track</span>
              <small>Find the right learning path for your skills</small>
            </button>

            <button
              className={`td-path-btn ${pathType === "college_and_track" ? "active" : ""}`}
              onClick={() => setPathType("college_and_track")}
            >
              <FaGraduationCap className="td-path-icon" />
              <span>College + Track</span>
              <small>High-school grad choosing a university major</small>
            </button>
          </div>

          {introError && <p className="td-error">{introError}</p>}

          <button
            className="td-start-btn"
            onClick={handleStart}
            disabled={chatLoading}
          >
            {chatLoading ? <FaSpinner className="td-spin" /> : "Start Interview"}
            {!chatLoading && <FaArrowRight />}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalyzingScreen({ userName }) {
  return (
    <div className="td-analyzing-page">
      <div className="td-analyzing-card">
        <div className="td-analyzing-spinner">
          <FaSpinner className="td-spin-large" />
        </div>
        <h2>Analyzing your answers, {userName}…</h2>
        <p>We're searching through career tracks and academic programs to find the best match for you.</p>
        <div className="td-analyzing-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

// ── Report rendering helpers ───────────────────────────────────
function isArabicText(s) { return /[؀-ۿ]/.test(s || ""); }

function InlineText({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

export function ReportView({ report }) {
  const rtl = isArabicText(report);
  const out = [];
  String(report || "").split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (/^[─—_]{3,}$/.test(line)) { out.push(<hr key={i} className="td-rhr" />); return; }
    if (/^#{1,6}\s/.test(line)) { out.push(<h4 key={i} className="td-rh">{line.replace(/^#{1,6}\s*/, "")}</h4>); return; }
    const num = line.match(/^(\d+)[.)]\s+(.*)/);
    if (num) {
      out.push(
        <div key={i} className="td-rnum">
          <span className="td-rnum-badge">{num[1]}</span>
          <span><InlineText text={num[2]} /></span>
        </div>
      );
      return;
    }
    if (/^[-•*]\s+/.test(line)) { out.push(<div key={i} className="td-rbul"><InlineText text={line.replace(/^[-•*]\s+/, "")} /></div>); return; }
    if (/^\*\*[^*]+\*\*$/.test(line) || (line.endsWith(":") && line.length < 60) || (line.endsWith("："))) {
      out.push(<p key={i} className="td-rsub"><InlineText text={line} /></p>); return;
    }
    out.push(<p key={i} className="td-rp"><InlineText text={line} /></p>);
  });
  return <div className={`td-report-text ${rtl ? "rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>{out}</div>;
}

function ResultScreen({ result, handleCreateRoadmap }) {
  if (!result) return null;

  const { report, suggested_track, suggested_tracks = [],
          suggested_colleges = [], user_name } = result;
  const topTrack = suggested_track || suggested_tracks[0]?.name;
  const otherTracks = suggested_tracks.filter(t => t.name !== topTrack);

  return (
    <div className="td-result-page">
      <div className="td-result-container">
        {/* Done badge */}
        <div className="td-done-badge">
          <FaCheckCircle />
          <span>Analysis Complete</span>
        </div>

        <h1>Your Personalized Report, {user_name}</h1>

        {/* Recommended colleges (college + track path) */}
        {suggested_colleges.length > 0 && (
          <div className="td-recommended-card td-colleges-card">
            <div className="td-rec-label">Recommended Colleges</div>
            <div className="td-college-list">
              {suggested_colleges.map((c, i) => (
                <div key={i} className="td-college-item">
                  <FaGraduationCap />
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top recommendation card */}
        {topTrack && (
          <div className="td-recommended-card">
            <div className="td-rec-label">Top Recommendation</div>
            <h2>{topTrack}</h2>
            <p>Based on your interview answers, this track is the best match for your skills and goals.</p>
            <button className="td-roadmap-btn" onClick={() => handleCreateRoadmap(topTrack)}>
              <FaRoute />
              Create Roadmap for "{topTrack}"
              <FaArrowRight />
            </button>

            {otherTracks.length > 0 && (
              <div className="td-other-tracks">
                <span className="td-other-label">Other strong matches — build a roadmap for any:</span>
                <div className="td-other-chips">
                  {otherTracks.map((t, i) => (
                    <button key={i} className="td-other-chip" onClick={() => handleCreateRoadmap(t.name)}>
                      <FaRoute /> {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full report */}
        <div className="td-report-card">
          <h3>Detailed Analysis</h3>
          <ReportView report={report} />
        </div>
      </div>
    </div>
  );
}
