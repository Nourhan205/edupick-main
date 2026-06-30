import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaRobot, FaUserCircle, FaPaperPlane, FaBars, FaTimes } from "react-icons/fa";
import logo from "../assets/logo2-removebg.png";
import "../styles/chatbot.css";

import { API_URL } from "../config";
const MAX_HISTORY = 8; // keep last 8 messages (4 turns) for context

// ── Render answer text (handles code blocks + line breaks) ────
function renderAnswer(text) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      return <pre key={i} className="cb-code-block"><code>{code}</code></pre>;
    }
    return (
      <span key={i}>
        {part.split("\n").map((line, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </span>
    );
  });
}

// ══════════════════════════════════════════════════════════════
export default function Chatbot() {
  const navigate  = useNavigate();
  const bottomRef = useRef(null);
  const email     = localStorage.getItem("userEmail") || "";

  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showPanel,   setShowPanel]   = useState(false);
  const [rmContext,   setRmContext]   = useState(null);  // sidebar data
  const [contextLoad, setContextLoad] = useState(false);

  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hi! I'm EduPick AI 👋\nAsk me anything — programming, math, study tips, or any topic you're learning. I'll explain clearly, with examples, in English or Arabic. If you have a saved roadmap, I'll tailor things to it too.",
    },
  ]);

  // ── Fetch roadmap context for sidebar on mount ─────────────
  useEffect(() => {
    if (!email) return;
    setContextLoad(true);
    fetch(`${API_URL}/chatbot/context?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => { if (data.context) setRmContext(data.context); })
      .catch(() => {})
      .finally(() => setContextLoad(false));
  }, [email]);

  // ── Auto-scroll ────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Build Groq-format history from message list ────────────
  const buildHistory = (msgs) =>
    msgs.slice(-MAX_HISTORY).map(m => ({
      role:    m.type === "bot" ? "assistant" : "user",
      content: m.text,
    }));

  // ── Send message ───────────────────────────────────────────
  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const newMessages = [...messages, { type: "user", text: question }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          email,
          history: buildHistory(messages), // exclude the just-added user msg
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages(prev => [...prev, { type: "bot", text: data.error || "Something went wrong. Please try again." }]);
      } else {
        setMessages(prev => [...prev, {
          type: "bot",
          text: data.answer,
          related_topic: data.related_topic,
          suggestions: data.suggestions,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        type: "bot",
        text: "Couldn't reach the server. Please check your connection.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (text) => { setInput(text); };

  // ════════════════════════════════════════════════════════════
  return (
    <div className="chat-page">

      {/* ── Header ── */}
      <div className="header">
        <div className="brand">
          <img src={logo} alt="EduPick AI" onError={e => e.target.style.display="none"} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {email && (
            <button className="roadmap-btn" onClick={() => navigate("/roadmap")}>
              My Roadmap
            </button>
          )}
          <button
            className="roadmap-btn"
            onClick={() => setShowPanel(p => !p)}
            title="Toggle roadmap panel"
          >
            {showPanel ? <FaTimes /> : <FaBars />}
            <span style={{ marginLeft: 6 }}>Context</span>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="chat-body">

        {/* ── Sidebar panel ── */}
        <div className={`roadmap-panel${showPanel ? " open" : ""}`}>
          <h3>Roadmap Context</h3>

          {contextLoad && <p style={{ color: "var(--ep-text-dim)", fontSize: 13, marginTop: 12 }}>Loading…</p>}

          {!contextLoad && !rmContext && (
            <div className="card">
              <p style={{ fontSize: 13, color: "var(--ep-text-mid)", lineHeight: 1.6 }}>
                {email
                  ? "No saved roadmap found. Generate one from the Roadmap page."
                  : "Log in and save a roadmap to see context here."
                }
              </p>
              {!email && (
                <button
                  className="roadmap-btn"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={() => navigate("/login")}
                >
                  Log in
                </button>
              )}
            </div>
          )}

          {rmContext && (
            <>
              <div className="topic-banner">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ep-text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Track</div>
                  <div style={{ fontWeight: 700, color: "var(--ep-text)", fontSize: 15 }}>{rmContext.track}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ep-text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Level</div>
                  <div style={{ fontWeight: 600, color: "var(--ep-sky)", textTransform: "capitalize" }}>{rmContext.level}</div>
                </div>
              </div>

              <div className="card">
                <h4>Overall Progress</h4>
                <div className="bar">
                  <div className="fill" style={{ width: `${rmContext.progress_pct}%` }} />
                </div>
                <span style={{ fontSize: 13, color: "var(--ep-text-mid)" }}>
                  {rmContext.done_tasks}/{rmContext.total_tasks} tasks — {rmContext.progress_pct}%
                </span>
              </div>

              <div className="card">
                <h4>Current Task</h4>
                <p style={{ fontSize: 13, color: "var(--ep-text)", lineHeight: 1.5 }}>{rmContext.current_task}</p>
              </div>

              {rmContext.next_task !== "—" && (
                <div className="card">
                  <h4>Up Next</h4>
                  <p style={{ fontSize: 13, color: "var(--ep-text-mid)", lineHeight: 1.5 }}>{rmContext.next_task}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.type}`}>
              <div className="avatar">
                {msg.type === "bot" ? <FaRobot /> : <FaUserCircle />}
              </div>
              <div className="bubble">
                <div>{renderAnswer(msg.text)}</div>

                {msg.related_topic && (
                  <div className="related-topic">
                    Topic: {msg.related_topic}
                  </div>
                )}

                {msg.suggestions?.length > 0 && (
                  <div className="suggestions">
                    {msg.suggestions.map((s, idx) => (
                      <button key={idx} onClick={() => handleSuggestion(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message bot">
              <div className="avatar"><FaRobot /></div>
              <div className="bubble">
                <span className="cb-typing">
                  <span /><span /><span />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

      </div>

      {/* ── Input ── */}
      <div className="input-area">
        <div className="input-wrapper">
          <input
            value={input}
            placeholder={rmContext ? `Ask about ${rmContext.track}…` : "Ask anything…"}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            disabled={loading}
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
            <FaPaperPlane />
          </button>
        </div>
      </div>

    </div>
  );
}
