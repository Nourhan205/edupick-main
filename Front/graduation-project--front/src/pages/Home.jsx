import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaTachometerAlt,
  FaRoad,
  FaRobot,
  FaSignInAlt,
  FaUserPlus,
  FaBars,
  FaTimes,
  FaChartLine,
  FaMapSigns,
  FaBalanceScale,
  FaClipboardList,
  FaArrowRight,
} from "react-icons/fa";
import logo from "../assets/logo2-removebg.png";
import Footer from "../components/Footer";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/Home.css";

const FEATURES = [
  { icon: <FaClipboardList />, title: "Smart Aptitude Quiz", text: "Discover the track that fits how you actually think." },
  { icon: <FaMapSigns />,      title: "AI Roadmaps",         text: "Personalized, step-by-step learning paths with real resources." },
  { icon: <FaRobot />,         title: "AI Study Mentor",     text: "Ask anything — get clear answers in your own language." },
  { icon: <FaBalanceScale />,  title: "Career Comparison",   text: "Compare tracks side by side with live market data." },
];

function Home() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="home-container">

      {/* Ambient orbs */}
      <div className="home-orb home-orb-1" />
      <div className="home-orb home-orb-2" />

      {/* ================= Navbar ================= */}
      <nav className="home-navbar">
        <div className="navbar-brand" onClick={() => navigate("/")}>
          <img src={logo} alt="EduPick" className="logo-image" />
          <span className="logo-text">EduPick</span>
        </div>

        <div className="navbar-actions">
          <ThemeToggle />
          <button className="nav-link" onClick={() => navigate("/login")}>
            <FaSignInAlt /> Login
          </button>
          <button className="nav-link signup-btn" onClick={() => navigate("/signup")}>
            <FaUserPlus /> Sign Up
          </button>
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <FaBars />
          </button>
        </div>
      </nav>

      {/* ================= Side Menu ================= */}
      <div className={`side-menu ${menuOpen ? "open" : ""}`}>
        <button className="close-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
          <FaTimes />
        </button>
        <ul>
          <li onClick={() => navigate("/dashboard")}><FaTachometerAlt /> Dashboard</li>
          <li onClick={() => navigate("/roadmap")}><FaRoad /> Roadmap</li>
          <li onClick={() => navigate("/ComparisonTool")}><FaBalanceScale /> Comparison Tool</li>
          <li onClick={() => navigate("/chatbot")}><FaRobot /> AI Assistant</li>
          <li onClick={() => navigate("/test")}><FaClipboardList /> Test Track</li>
        </ul>
      </div>
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}

      {/* ================= Hero ================= */}
      <header className="home-hero">
        <div className="hero-content">
          <span className="hero-eyebrow ep-anim-up">
            <span className="hero-dot" /> AI-powered learning guidance
          </span>

          <h1 className="ep-anim-up ep-d1">
            Find your path with <span className="gradient-text">EduPick</span>
          </h1>

          <p className="hero-subtitle ep-anim-up ep-d2">
            Your intelligent companion for choosing the right track, building a
            personalized roadmap, and learning faster — in English or Arabic.
          </p>

          <div className="hero-cta ep-anim-up ep-d3">
            <button className="primary-btn" onClick={() => navigate("/signup")}>
              Start Learning Free <FaArrowRight />
            </button>
            <button className="secondary-btn" onClick={() => navigate("/dashboard")}>
              Explore Dashboard
            </button>
          </div>

          <div className="hero-stats ep-anim-up ep-d4">
            <div className="hero-stat"><strong>6+</strong><span>Career tracks</span></div>
            <div className="hero-stat"><strong>AI</strong><span>Roadmaps</span></div>
            <div className="hero-stat"><strong>EN / AR</strong><span>Bilingual</span></div>
          </div>
        </div>

        <div className="hero-image ep-anim-scale ep-d2">
          <div className="hero-glow-ring" />
          <div className="floating-elements">
            <div className="floating-card floating-1">
              <FaChartLine /><span>Progress Tracking</span>
            </div>
            <div className="floating-card floating-2">
              <FaMapSigns /><span>Custom Roadmaps</span>
            </div>
            <div className="floating-card floating-3">
              <FaRobot /><span>AI Assistant</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= Feature strip ================= */}
      <section className="home-features">
        {FEATURES.map((f, i) => (
          <div className={`feature-card ep-anim-up ep-d${i + 1}`} key={i}>
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      {/* ================= How it works / Footer ================= */}
      <Footer />

    </div>
  );
}

export default Home;
