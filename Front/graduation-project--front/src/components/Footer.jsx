import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserPlus, FaMicrophone, FaMapSigns, FaClipboardList,
  FaRobot, FaBalanceScale, FaChartLine,
} from "react-icons/fa";
import logo from "../assets/logo2-removebg.png";
import "./Footer.css";

const STEPS = [
  {
    icon: <FaUserPlus />,
    step: "01",
    title: "Create your account",
    text: "Sign up and tell us your age and whether you're a student or graduate — so every recommendation fits you.",
  },
  {
    icon: <FaMicrophone />,
    step: "02",
    title: "Take the discovery interview",
    text: "Answer a short guided interview. EduPick analyzes your answers and recommends the 3 tracks that match you best.",
  },
  {
    icon: <FaMapSigns />,
    step: "03",
    title: "Build your AI roadmap",
    text: "Turn a recommended track into a step-by-step learning path with real resources — timeline, kanban, or checklist.",
  },
  {
    icon: <FaClipboardList />,
    step: "04",
    title: "Quiz yourself",
    text: "Generate a quiz on any roadmap topic (or a whole roadmap) in English or Arabic, then save your score.",
  },
  {
    icon: <FaRobot />,
    step: "05",
    title: "Ask the AI assistant",
    text: "Stuck on a concept? Ask anything — you get clear, example-rich answers in your own language, tied to your roadmap.",
  },
  {
    icon: <FaBalanceScale />,
    step: "06",
    title: "Compare & track progress",
    text: "Compare career tracks side by side with live data, and watch your progress and streaks on your dashboard.",
  },
];

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="ft" id="how-it-works">
      <div className="ft-inner">

        <div className="ft-head">
          <span className="ft-eyebrow">How it works</span>
          <h2>Your journey with <span className="ft-grad">EduPick</span></h2>
          <p>From "I don't know what to study" to a clear, personalized plan — in six steps.</p>
        </div>

        <div className="ft-steps">
          {STEPS.map((s, i) => (
            <div className="ft-step" key={i}>
              <div className="ft-step-media">
                <span className="ft-step-num">{s.step}</span>
                <div className="ft-step-icon">{s.icon}</div>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>

        <div className="ft-cta">
          <FaChartLine className="ft-cta-icon" />
          <div>
            <h3>Ready to find your path?</h3>
            <p>Create a free account and take the interview in under 5 minutes.</p>
          </div>
          <button className="ft-cta-btn" onClick={() => navigate("/signup")}>Get started free</button>
        </div>

        <div className="ft-bottom">
          <div className="ft-brand">
            <img src={logo} alt="EduPick" />
            <span>EduPick</span>
          </div>
          <div className="ft-links">
            <button onClick={() => navigate("/how-to-use")}>How to use</button>
            <button onClick={() => navigate("/signup")}>Sign up</button>
            <button onClick={() => navigate("/login")}>Login</button>
          </div>
          <p className="ft-copy">© {new Date().getFullYear()} EduPick — Your intelligent learning companion.</p>
        </div>

      </div>
    </footer>
  );
}
