import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserPlus, FaMicrophone, FaMapSigns, FaClipboardList,
  FaRegCommentDots, FaBalanceScale, FaThLarge, FaRegUser, FaArrowRight,
} from "react-icons/fa";
import "../styles/Guide.css";

const SECTIONS = [
  {
    icon: <FaUserPlus />,
    tag: "Step 1",
    title: "Create your account",
    points: [
      "Sign up with your name, email and a password.",
      "Tell us your age and whether you're a student or a graduate — and if you're in high school or college.",
      "This profile personalizes your interview, roadmap and recommendations from the start.",
    ],
    to: "/signup", cta: "Create account",
  },
  {
    icon: <FaMicrophone />,
    tag: "Step 2",
    title: "Take the discovery interview",
    points: [
      "A real, guided interview — it reacts to your answers and digs deeper.",
      "It uses your profile and a knowledge base of tracks & college departments.",
      "At the end you get a personalized report plus your top 3 matching tracks.",
    ],
    to: "/discover", cta: "Start interview",
  },
  {
    icon: <FaMapSigns />,
    tag: "Step 3",
    title: "Build your roadmap",
    points: [
      "Turn any recommended track into a step-by-step learning plan with real resources.",
      "View it as a timeline, kanban board or checklist.",
      "Tick tasks as you finish them — your progress is saved automatically.",
    ],
    to: "/roadmap", cta: "Build a roadmap",
  },
  {
    icon: <FaClipboardList />,
    tag: "Step 4",
    title: "Quiz yourself",
    points: [
      "Generate a quiz on any roadmap topic, a whole roadmap, or any topic you type.",
      "Choose English or Arabic and how many questions.",
      "Solve it, see what you missed, and save your score to track progress.",
    ],
    to: "/test", cta: "Take a quiz",
  },
  {
    icon: <FaRegCommentDots />,
    tag: "Step 5",
    title: "Ask the AI assistant",
    points: [
      "Ask anything — programming, math, study tips, any topic you're learning.",
      "You get clear, example-rich answers in your own language.",
      "Use the floating chat button on the bottom-right from any page.",
    ],
    to: "/chatbot", cta: "Open the assistant",
  },
  {
    icon: <FaBalanceScale />,
    tag: "Step 6",
    title: "Compare & track",
    points: [
      "Compare career tracks side by side with live web data and sources.",
      "One click adds your interview tracks to the comparison.",
      "Watch progress, streaks and recommendations on your dashboard.",
    ],
    to: "/ComparisonTool", cta: "Compare tracks",
  },
];

export default function Guide() {
  const navigate = useNavigate();
  return (
    <div className="gd-page">

      <header className="gd-hero">
        <span className="gd-eyebrow">User Guide</span>
        <h1>How to use <span className="gd-grad">EduPick</span></h1>
        <p>Everything the platform does — and exactly how to get the most out of each part.</p>
        <div className="gd-quick">
          {[
            { i: <FaThLarge />, l: "Dashboard", to: "/dashboard" },
            { i: <FaMicrophone />, l: "Interview", to: "/discover" },
            { i: <FaMapSigns />, l: "Roadmap", to: "/roadmap" },
            { i: <FaClipboardList />, l: "Quiz", to: "/test" },
            { i: <FaRegCommentDots />, l: "Assistant", to: "/chatbot" },
            { i: <FaRegUser />, l: "Profile", to: "/profile" },
          ].map((q, i) => (
            <button key={i} className="gd-quick-chip" onClick={() => navigate(q.to)}>
              {q.i} {q.l}
            </button>
          ))}
        </div>
      </header>

      <div className="gd-sections">
        {SECTIONS.map((s, i) => (
          <section className={`gd-section${i % 2 ? " gd-section--rev" : ""}`} key={i}>
            <div className="gd-media">
              <span className="gd-media-tag">{s.tag}</span>
              <div className="gd-media-icon">{s.icon}</div>
            </div>
            <div className="gd-body">
              <h2>{s.title}</h2>
              <ul>
                {s.points.map((p, j) => <li key={j}>{p}</li>)}
              </ul>
              <button className="gd-cta" onClick={() => navigate(s.to)}>
                {s.cta} <FaArrowRight />
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="gd-foot-cta">
        <h3>That's the whole journey.</h3>
        <p>Start wherever you like — the dashboard always shows your recommended next step.</p>
        <button className="gd-cta" onClick={() => navigate("/dashboard")}>Go to dashboard <FaArrowRight /></button>
      </div>
    </div>
  );
}
