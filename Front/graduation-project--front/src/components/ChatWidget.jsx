import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaRegCommentDots, FaTimes, FaPaperPlane, FaRobot, FaExpand } from "react-icons/fa";
import "./ChatWidget.css";

import { API_URL } from "../config";
const MAX_HISTORY = 8;

function renderText(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => (
    <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
  ));
}

export default function ChatWidget() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const email = localStorage.getItem("userEmail") || "";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { type: "bot", text: "Hi! I'm your EduPick assistant 👋 Ask me anything you're learning." },
  ]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const prior = messages;
    setMessages(m => [...m, { type: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          email,
          history: prior.slice(-MAX_HISTORY).map(m => ({
            role: m.type === "bot" ? "assistant" : "user", content: m.text,
          })),
        }),
      });
      const data = await res.json();
      setMessages(m => [...m, { type: "bot", text: data.answer || data.error || "Something went wrong." }]);
    } catch {
      setMessages(m => [...m, { type: "bot", text: "Couldn't reach the server. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={`cw-fab${open ? " cw-fab--open" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Open AI assistant"
      >
        {open ? <FaTimes /> : <FaRegCommentDots />}
      </button>

      {open && (
        <div className="cw-panel">
          <div className="cw-head">
            <div className="cw-head-brand">
              <span className="cw-head-avatar"><FaRobot /></span>
              <div>
                <strong>EduPick Assistant</strong>
                <span>Always here to help</span>
              </div>
            </div>
            <div className="cw-head-actions">
              <button title="Open full chat" onClick={() => { setOpen(false); navigate("/chatbot"); }}><FaExpand /></button>
              <button title="Close" onClick={() => setOpen(false)}><FaTimes /></button>
            </div>
          </div>

          <div className="cw-messages">
            {messages.map((m, i) => (
              <div key={i} className={`cw-msg cw-${m.type}`}>
                {m.type === "bot" && <span className="cw-avatar"><FaRobot /></span>}
                <div className="cw-bubble">{renderText(m.text)}</div>
              </div>
            ))}
            {loading && (
              <div className="cw-msg cw-bot">
                <span className="cw-avatar"><FaRobot /></span>
                <div className="cw-bubble"><span className="cw-typing"><span/><span/><span/></span></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="cw-input">
            <input
              value={input}
              placeholder="Ask anything…"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()}><FaPaperPlane /></button>
          </div>
        </div>
      )}
    </>
  );
}
