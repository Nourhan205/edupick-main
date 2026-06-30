import React from 'react';
import '../styles/test.css';
import { useNavigate } from "react-router-dom";
import {
  FaClipboardList, FaHistory, FaArrowRight,
} from "react-icons/fa";

const OPTIONS = [
  {
    icon: <FaClipboardList />,
    title: "Quiz from your roadmap",
    text: "Pick a topic — or a whole roadmap — and get a custom test in English or Arabic, then save your score.",
    to: "/test/topic-test",
    primary: true,
  },
  {
    icon: <FaHistory />,
    title: "Previous results",
    text: "Review your past quiz attempts and track your scores over time.",
    to: "/test/previous-results",
  },
];

const Test = () => {
  const navigate = useNavigate();
  return (
    <div className="test-page">
      <header className="test-hero">
        <h1>Test your knowledge</h1>
        <p>Quizzes built around <strong>your</strong> learning — not generic question banks.</p>
      </header>

      <div className="test-grid">
        {OPTIONS.map((o, i) => (
          <button
            key={i}
            className={`test-card${o.primary ? " test-card--primary" : ""} ep-anim-up ep-d${i + 1}`}
            onClick={() => navigate(o.to)}
          >
            <div className="test-card-icon">{o.icon}</div>
            <h3>{o.title}</h3>
            <p>{o.text}</p>
            <span className="test-card-cta">Open <FaArrowRight /></span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Test;
