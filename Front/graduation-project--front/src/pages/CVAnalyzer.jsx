import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaFileAlt, FaSpinner, FaUpload, FaArrowLeft,
  FaCheckCircle, FaTimesCircle, FaExclamationCircle,
  FaBullseye, FaRobot, FaPenNib, FaRoute,
} from "react-icons/fa";
import "../styles/CVAnalyzer.css";

import { API_URL } from "../config";

// ── helpers ───────────────────────────────────────────────────
function scoreClass(score) {
  if (score >= 70) return "cv-good";
  if (score >= 50) return "cv-mid";
  return "cv-low";
}

// Build a roadmap "goal" string from the CV gaps.
// Mirrors weaknesses_to_goal() in cv_analyzer.py so the handoff is consistent.
function buildGoalFromGaps(jobTitle, weaknesses = [], partial = []) {
  const missing = (weaknesses || []).filter(Boolean);
  const deepen  = (partial   || []).filter(Boolean);

  if (missing.length) {
    let goal = `Become job-ready for a ${jobTitle} role by mastering these missing CV skills: `
             + `${missing.slice(0, 10).join(", ")}.`;
    if (deepen.length) {
      goal += ` Also deepen these partially-covered skills: ${deepen.slice(0, 6).join(", ")}.`;
    }
    goal += " Each skill should end with a portfolio project that can be added to the CV.";
    return goal;
  }
  if (deepen.length) {
    return `Strengthen the partially-covered skills for a ${jobTitle} role to full proficiency: `
         + `${deepen.slice(0, 10).join(", ")}. `
         + "Build a portfolio project for each so they become CV-ready strengths.";
  }
  return `Advance an already-qualified ${jobTitle} candidate to the next level with `
       + "advanced, in-demand skills and a standout portfolio project.";
}

function ScoreRing({ pct, label, sub, size = 120, stroke = 10 }) {
  const safePct = Number.isFinite(pct) ? pct : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, safePct)) / 100) * circ;
  return (
    <div className="cv-ring-wrap">
      <svg width={size} height={size} className="cv-ring">
        <circle cx={size / 2} cy={size / 2} r={r} className="cv-ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className={`cv-ring-fill ${scoreClass(safePct)}`}
          strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="48%" className="cv-ring-num" textAnchor="middle" dominantBaseline="middle">
          {Math.round(safePct)}
        </text>
        <text x="50%" y="66%" className="cv-ring-pct" textAnchor="middle" dominantBaseline="middle">%</text>
      </svg>
      <span className="cv-ring-label">{label}</span>
      {sub && <span className="cv-ring-sub">{sub}</span>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function CVAnalyzer() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [stage, setStage]   = useState("form");      // form | loading | result
  const [jobTitle, setJob]  = useState("");
  const [file, setFile]     = useState(null);
  const [dragOver, setDrag] = useState(false);
  const [error, setError]   = useState("");
  const [report, setReport] = useState(null);

  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError,   setRoadmapError]   = useState("");

  // ── form handlers ──────────────────────────────────────────
  const pickFile = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setError("");
    setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  // ── analyze ────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!jobTitle.trim()) return setError("Please enter the job title to analyze against.");
    if (!file)            return setError("Please upload your CV (PDF).");
    setError(""); setStage("loading");

    try {
      const fd = new FormData();
      fd.append("cv", file);
      fd.append("job_title", jobTitle.trim());
      const email = localStorage.getItem("userEmail") || "";
      if (email) fd.append("email", email);

      const res  = await fetch(`${API_URL}/cv/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.details || data.error || "Analysis failed");
      }
      setReport(data.report || data);
      setStage("result");
    } catch (e) {
      setError(e.message || "Could not reach the server.");
      setStage("form");
    }
  };

  // ── generate a roadmap from the CV gaps ────────────────────
  const handleGenerateRoadmap = async () => {
    if (!report) return;
    setRoadmapError("");
    setRoadmapLoading(true);
    try {
      const goal = buildGoalFromGaps(report.job_title, report.weaknesses, report.partial_matches);
      const res  = await fetch(`${API_URL}/roadmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: report.job_title, level: "beginner", goal }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to generate roadmap");
      navigate("/roadmap", { state: { cvRoadmap: data.roadmap } });
    } catch (e) {
      setRoadmapError(e.message || "Could not generate the roadmap. Please try again.");
    } finally {
      setRoadmapLoading(false);
    }
  };

  const reset = () => {
    setReport(null); setFile(null); setError("");
    setRoadmapError(""); setRoadmapLoading(false);
    setStage("form");
  };

  // ══════════════════════════════════════════════════════════
  if (stage === "loading") return <LoadingScreen />;

  if (stage === "result" && report) {
    return (
      <ResultScreen
        report={report}
        onBack={reset}
        onGenerateRoadmap={handleGenerateRoadmap}
        roadmapLoading={roadmapLoading}
        roadmapError={roadmapError}
      />
    );
  }

  // ── Form ──────────────────────────────────────────────────
  return (
    <div className="cv-page">
      <div className="cv-form-card">
        <div className="cv-form-header">
          <div className="cv-form-icon"><FaFileAlt /></div>
          <h1>CV Analyzer</h1>
          <p>Upload your CV and a target job title. We'll score skill fit, ATS readiness, and writing quality — then build a roadmap from your gaps.</p>
        </div>

        <div className="cv-field">
          <label>Target Job Title</label>
          <input
            type="text"
            placeholder="e.g. Data Analyst, Graphic Designer, Backend Engineer"
            value={jobTitle}
            onChange={(e) => setJob(e.target.value)}
          />
        </div>

        <div className="cv-field">
          <label>Your CV (PDF)</label>
          <div
            className={`cv-dropzone${dragOver ? " cv-dropzone-active" : ""}${file ? " cv-dropzone-filled" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            <FaUpload className="cv-drop-icon" />
            {file
              ? <span className="cv-drop-file">{file.name}</span>
              : <span className="cv-drop-text">Drag &amp; drop your PDF here, or <b>browse</b></span>}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {error && <p className="cv-error">{error}</p>}

        <button className="cv-analyze-btn" onClick={handleAnalyze}>
          <FaFileAlt /> Analyze My CV
        </button>
      </div>
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="cv-loading-page">
      <div className="cv-loading-card">
        <FaSpinner className="cv-spin-large" />
        <h2>Analyzing your CV…</h2>
        <p>We're extracting skills, matching requirements, and scoring ATS readiness. This may take up to 30 seconds.</p>
        <div className="cv-dots"><span /><span /><span /></div>
      </div>
    </div>
  );
}

// ── Skill chips ───────────────────────────────────────────────
function SkillChips({ items, kind }) {
  if (!items?.length) return <span className="cv-empty">— none —</span>;
  const Icon = kind === "ok" ? FaCheckCircle : kind === "partial" ? FaExclamationCircle : FaTimesCircle;
  return (
    <div className="cv-chips">
      {items.map((s, i) => (
        <span key={i} className={`cv-chip cv-chip-${kind}`}><Icon /> {s}</span>
      ))}
    </div>
  );
}

// ── Result screen ─────────────────────────────────────────────
function ResultScreen({ report, onBack, onGenerateRoadmap, roadmapLoading, roadmapError }) {
  const match = report.match_score ?? 0;
  const ats   = report.ats_score ?? 0;
  const content = report.content_score ?? 0;

  const hasGaps =
    (report.weaknesses?.length || 0) > 0 ||
    (report.partial_matches?.length || 0) > 0;

  return (
    <div className="cv-result-page">
      <div className="cv-result-header cv-no-print">
        <button className="cv-back-btn" onClick={onBack}><FaArrowLeft /> New analysis</button>
        <div className="cv-result-title">
          <h1>{report.job_title}</h1>
          <span className={`cv-verdict ${scoreClass(match)}`}>{report.verdict}</span>
        </div>
      </div>

      {/* Score rings */}
      <div className="cv-rings">
        <ScoreRing pct={match}   label="Skill Match"  sub={`${report.strengths?.length || 0} matched`} />
        <ScoreRing pct={ats}     label="ATS Score"    sub={report.ats_rating} />
        <ScoreRing pct={content} label="Writing"      sub={report.content_rating} />
      </div>

      {/* Generate roadmap CTA */}
      {hasGaps && (
        <div className="cv-roadmap-cta">
          <div className="cv-roadmap-cta-text">
            <FaRoute className="cv-roadmap-cta-icon" />
            <div>
              <h3>Turn your gaps into a learning plan</h3>
              <p>We'll build a personalized roadmap focused on the skills your CV is missing.</p>
            </div>
          </div>
          <button className="cv-roadmap-btn" onClick={onGenerateRoadmap} disabled={roadmapLoading}>
            {roadmapLoading ? <FaSpinner className="cv-spin" /> : <FaRoute />}
            {roadmapLoading ? "Building…" : "Generate roadmap from gaps"}
          </button>
        </div>
      )}
      {roadmapError && <p className="cv-error cv-no-print">{roadmapError}</p>}

      {/* Skills breakdown */}
      <div className="cv-section">
        <h2><FaBullseye /> Skill Fit vs. {report.job_title}</h2>
        <div className="cv-skill-grid">
          <div className="cv-skill-col">
            <span className="cv-skill-head cv-good">Strengths ({report.strengths?.length || 0})</span>
            <SkillChips items={report.strengths} kind="ok" />
          </div>
          <div className="cv-skill-col">
            <span className="cv-skill-head cv-mid">Partial ({report.partial_matches?.length || 0})</span>
            <SkillChips items={report.partial_matches} kind="partial" />
          </div>
          <div className="cv-skill-col">
            <span className="cv-skill-head cv-low">Missing ({report.weaknesses?.length || 0})</span>
            <SkillChips items={report.weaknesses} kind="missing" />
          </div>
        </div>
      </div>

      {/* ATS + Content tips */}
      <div className="cv-tips-grid">
        <div className="cv-section">
          <h2><FaRobot /> ATS Readiness — {report.ats_score}%</h2>
          <p className="cv-section-sub">{report.ats_rating}</p>
          <ul className="cv-tips">
            {(report.ats_improvement_tips || []).map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
        <div className="cv-section">
          <h2><FaPenNib /> Writing Quality — {report.content_score}%</h2>
          <p className="cv-section-sub">{report.content_rating}</p>
          <ul className="cv-tips">
            {(report.content_improvement_tips || []).map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
