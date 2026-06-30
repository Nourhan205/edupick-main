import { useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/MainTest.css";

import { API_URL } from "../config";

// ── 12 career aptitude questions ──────────────────────────────
// A=Tech  B=Business  C=Engineering  D=Medical  E=Creative  F=Education
const QUESTIONS = [
  {
    id: 1,
    question: "What kind of problems do you enjoy solving?",
    options: {
      A: "Logical or coding problems 💻",
      B: "Real-world systems (machines, structures) ⚙️",
      C: "Helping people with their issues 👥",
      D: "Understanding human behavior 📊",
      E: "Designing or creating something new 🎨",
      F: "Health-related or biological problems 🏥",
    },
  },
  {
    id: 2,
    question: "What activity sounds most interesting?",
    options: {
      A: "Building an app or website 💻",
      B: "Running a business or project 📊",
      C: "Designing a bridge or machine ⚙️",
      D: "Working in a hospital 🏥",
      E: "Creating art or digital designs 🎨",
      F: "Teaching or guiding others 👥",
    },
  },
  {
    id: 3,
    question: "What do you enjoy more?",
    options: {
      A: "Working with computers 💻",
      B: "Leading and organizing people 📊",
      C: "Fixing or building things ⚙️",
      D: "Caring for people 🏥",
      E: "Expressing ideas visually 🎨",
      F: "Explaining things to others 👥",
    },
  },
  {
    id: 4,
    question: "When learning something new, you prefer:",
    options: {
      A: "Tutorials and coding 💻",
      B: "Case studies and real scenarios 📊",
      C: "Hands-on building ⚙️",
      D: "Practical training (labs, clinics) 🏥",
      E: "Creative projects 🎨",
      F: "Discussions and explanations 👥",
    },
  },
  {
    id: 5,
    question: "What motivates you most?",
    options: {
      A: "Solving complex problems 💻",
      B: "Achieving business success 📊",
      C: "Building something useful ⚙️",
      D: "Saving or helping lives 🏥",
      E: "Creating something beautiful 🎨",
      F: "Helping others grow 👥",
    },
  },
  {
    id: 6,
    question: "Which environment do you prefer?",
    options: {
      A: "Working on a computer 💻",
      B: "Office / business environment 📊",
      C: "Workshops / field work ⚙️",
      D: "Hospitals / clinics 🏥",
      E: "Studio / creative space 🎨",
      F: "Classroom / community 👥",
    },
  },
  {
    id: 7,
    question: "What are you better at?",
    options: {
      A: "Logical thinking 💻",
      B: "Communication & negotiation 📊",
      C: "Problem-solving with tools ⚙️",
      D: "Understanding biology 🏥",
      E: "Creativity 🎨",
      F: "Empathy and listening 👥",
    },
  },
  {
    id: 8,
    question: "Which subject do you enjoy most?",
    options: {
      A: "Computer science / math 💻",
      B: "Business / economics 📊",
      C: "Physics ⚙️",
      D: "Biology 🏥",
      E: "Art / design 🎨",
      F: "Psychology / sociology 👥",
    },
  },
  {
    id: 9,
    question: "What kind of projects excite you?",
    options: {
      A: "Apps, AI, or tech systems 💻",
      B: "Business ideas 📊",
      C: "Engineering models ⚙️",
      D: "Medical case studies 🏥",
      E: "Creative portfolios 🎨",
      F: "Community or education projects 👥",
    },
  },
  {
    id: 10,
    question: "What role do you prefer in a team?",
    options: {
      A: "Technical problem solver 💻",
      B: "Leader or planner 📊",
      C: "Builder / implementer ⚙️",
      D: "Caregiver / supporter 🏥",
      E: "Designer 🎨",
      F: "Mentor 👥",
    },
  },
  {
    id: 11,
    question: "What would you enjoy daily?",
    options: {
      A: "Coding and debugging 💻",
      B: "Managing projects 📊",
      C: "Designing systems ⚙️",
      D: "Treating patients 🏥",
      E: "Creating designs 🎨",
      F: "Teaching people 👥",
    },
  },
  {
    id: 12,
    question: "Which word describes you best?",
    options: {
      A: "Analytical 💻",
      B: "Strategic 📊",
      C: "Practical ⚙️",
      D: "Caring 🏥",
      E: "Creative 🎨",
      F: "Supportive 👥",
    },
  },
];

// ══════════════════════════════════════════════════════════════
export default function MainTest() {
  const navigate = useNavigate();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers,         setAnswers]         = useState({});
  const [selectedOption,  setSelectedOption]  = useState(null);
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [result,          setResult]          = useState(null);
  const [error,           setError]           = useState(null);

  const isLastQuestion = currentQuestion === QUESTIONS.length - 1;
  const q              = QUESTIONS[currentQuestion];
  const progress       = ((currentQuestion + (selectedOption ? 1 : 0)) / QUESTIONS.length) * 100;
  const email          = localStorage.getItem("userEmail") || "";

  const handleSelect = (option) => setSelectedOption(option);

  const handleNext = () => {
    if (!selectedOption) return;
    setAnswers(prev => ({ ...prev, [q.id]: selectedOption }));
    setSelectedOption(null);
    setCurrentQuestion(c => c + 1);
  };

  const handleSubmit = async () => {
    if (!selectedOption) return;
    const finalAnswers = { ...answers, [q.id]: selectedOption };
    setAnswers(finalAnswers);
    setIsSubmitting(true);
    setError(null);

    try {
      const res  = await fetch(`${API_URL}/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers:     finalAnswers,
          email:       email,
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setSelectedOption(null);
    setResult(null);
    setError(null);
  };

  // ── Result screen ───────────────────────────────────────────
  if (result) {
    return (
      <ResultScreen
        result={result}
        onRetake={handleRestart}
        onNavigate={(track) => navigate("/roadmap", { state: { suggestedTrack: track } })}
      />
    );
  }

  // ── Quiz screen ─────────────────────────────────────────────
  return (
    <div className="ep-page">
      <header className="ep-header">
        <div className="ep-logo">EduPick</div>
        <span className="ep-tagline">Find your path</span>
      </header>

      <div className="ep-progress-wrap">
        <div className="ep-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <main className="ep-main">
        <div className="ep-card">
          <div className="ep-counter">
            <span className="ep-counter-current">{currentQuestion + 1}</span>
            <span className="ep-counter-sep">/</span>
            <span className="ep-counter-total">{QUESTIONS.length}</span>
          </div>

          <h2 className="ep-question">{q.question}</h2>

          <div className="ep-options">
            {Object.entries(q.options).map(([key, value]) => (
              <button
                key={key}
                className={`ep-option${selectedOption === key ? " ep-option--selected" : ""}`}
                onClick={() => handleSelect(key)}
              >
                <span className="ep-option-key">{key}</span>
                <span className="ep-option-label">{value}</span>
              </button>
            ))}
          </div>

          {error && <p className="ep-error">{error}</p>}

          <div className="ep-actions">
            {isLastQuestion ? (
              <button
                className="ep-btn ep-btn-submit"
                onClick={handleSubmit}
                disabled={!selectedOption || isSubmitting}
              >
                {isSubmitting ? <span className="ep-spinner" /> : "Submit Answers ✦"}
              </button>
            ) : (
              <button
                className="ep-btn ep-btn-primary"
                onClick={handleNext}
                disabled={!selectedOption}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Result screen component ───────────────────────────────────
function ResultScreen({ result, onRetake, onNavigate }) {
  const { top_track, top_emoji, match_pct, scores, insight, suggested_tracks } = result;

  return (
    <div className="ep-page">
      <header className="ep-header">
        <div className="ep-logo">EduPick</div>
        <span className="ep-tagline">Your Results</span>
      </header>

      <main className="ep-main">
        <div className="ep-card ep-result-card">

          {/* Top match headline */}
          <div className="ep-result-badge">Career Match</div>
          <div className="ep-result-top">
            <span className="ep-result-emoji">{top_emoji}</span>
            <h2 className="ep-result-track">{top_track}</h2>
          </div>
          <div className="ep-result-pct-wrap">
            <div className="ep-result-pct-bar" style={{ width: `${match_pct}%` }} />
            <span className="ep-result-pct-label">{match_pct}% match</span>
          </div>

          {/* AI insight */}
          <p className="ep-result-insight">{insight}</p>

          {/* Score breakdown */}
          <div className="ep-scores">
            <p className="ep-scores-title">Your Profile Breakdown</p>
            {scores.filter(s => s.pct > 0).map(s => (
              <div key={s.key} className="ep-score-row">
                <span className="ep-score-label">
                  {s.emoji} {s.track}
                </span>
                <div className="ep-score-bar-wrap">
                  <div
                    className={`ep-score-bar${s.key === result.top_key ? " ep-score-bar--top" : ""}`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className="ep-score-pct">{s.pct}%</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="ep-result-actions">
            <button
              className="ep-btn ep-btn-submit"
              onClick={() => onNavigate(top_track)}
            >
              Build {top_track} Roadmap →
            </button>
            <button className="ep-btn ep-btn-ghost" onClick={onRetake}>
              Retake Quiz
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
