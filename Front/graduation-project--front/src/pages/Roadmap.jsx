import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaGraduationCap, FaSpinner, FaRedo, FaSave, FaPrint,
  FaCheckCircle, FaCircle, FaTimes,
  FaChevronDown, FaChevronUp, FaBook, FaVideo,
  FaLink, FaPencilAlt, FaArrowLeft, FaShareAlt, FaQuestionCircle,
  FaLaptopCode,
} from "react-icons/fa";
import "../styles/Roadmap.css";

import { API_URL } from "../config";

const RESOURCE_ICONS = {
  video:    <FaVideo />,
  course:   <FaGraduationCap />,
  article:  <FaBook />,
  book:     <FaBook />,
  practice: <FaLink />,
};

function calcProgress(phases) {
  if (!phases?.length) return 0;
  const total = phases.reduce((s, p) => s + (p.tasks?.length || 0), 0);
  const done  = phases.reduce((s, p) => s + p.tasks.filter(t => t.completed).length, 0);
  return total ? Math.round((done / total) * 100) : 0;
}

function toggleTask(roadmap, pi, ti) {
  return {
    ...roadmap,
    phases: roadmap.phases.map((phase, pIdx) =>
      pIdx !== pi ? phase : {
        ...phase,
        tasks: phase.tasks.map((task, tIdx) =>
          tIdx !== ti ? task : { ...task, completed: !task.completed }
        ),
      }
    ),
  };
}

function toggleProject(roadmap, pi) {
  return {
    ...roadmap,
    phases: roadmap.phases.map((phase, pIdx) =>
      pIdx !== pi || !phase.project ? phase : {
        ...phase,
        project: { ...phase.project, completed: !phase.project.completed },
      }
    ),
  };
}

// ── HTML share helpers ────────────────────────────────────────
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateShareHTML(roadmap) {
  const phases   = roadmap.phases || [];
  const total    = phases.reduce((s, p) => s + (p.tasks?.length || 0), 0);
  const done     = phases.reduce((s, p) => s + p.tasks.filter(t => t.completed).length, 0);
  const progress = total ? Math.round((done / total) * 100) : 0;
  const date     = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const phasesHTML = phases.map(phase => {
    const tasksHTML = (phase.tasks || []).map(task => {
      const resHTML = (task.resources || [])
        .map(r => `<a href="${escHtml(r.url || "#")}" target="_blank" class="res-chip">${escHtml(r.title)}</a>`)
        .join("");
      return `
      <div class="task${task.completed ? " task-done" : ""}">
        <div class="task-top">
          <span class="chk">${task.completed ? "✓" : "○"}</span>
          <div class="task-info">
            <span class="task-title">${escHtml(task.title)}</span>
            <span class="task-dur">${escHtml(task.duration)}</span>
          </div>
        </div>
        <div class="task-body">
          <p class="task-desc">${escHtml(task.description)}</p>
          ${resHTML ? `<div class="res-row"><span class="res-label">Resources</span>${resHTML}</div>` : ""}
        </div>
      </div>`;
    }).join("");

    return `
    <div class="phase">
      <div class="phase-left"><div class="phase-dot">${phase.phase_number}</div></div>
      <div class="phase-body">
        <div class="phase-head">
          <h2>${escHtml(phase.title)}</h2>
          <span class="dur">${escHtml(phase.duration)}</span>
        </div>
        <p class="phase-desc">${escHtml(phase.description)}</p>
        <div class="tasks">${tasksHTML}</div>
      </div>
    </div>`;
  }).join("");

  const css = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f0f4ff;color:#1e3a5f}
    .wrap{max-width:860px;margin:0 auto;padding:32px 20px}
    .header{background:#1565c0;color:#fff;padding:28px 32px;border-radius:16px 16px 0 0}
    .header-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
    .header h1{font-size:24px;font-weight:800}
    .level-tag{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;text-transform:capitalize;white-space:nowrap}
    .header-meta{margin-top:10px;font-size:13px;opacity:.8}
    .goal-text{margin-top:8px;font-size:15px;opacity:.9;line-height:1.5}
    .strip{background:#0d47a1;color:#fff;display:flex;flex-wrap:wrap}
    .strip-item{flex:1;min-width:110px;padding:14px 20px;border-right:1px solid rgba(255,255,255,.15)}
    .strip-item:last-child{border-right:none}
    .strip-label{font-size:10px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .strip-value{font-size:18px;font-weight:800}
    .prog-bar{height:6px;background:rgba(255,255,255,.25);border-radius:3px;margin-top:6px;overflow:hidden}
    .prog-fill{height:100%;background:#fff;border-radius:3px}
    .content{background:#fff;border-radius:0 0 16px 16px;padding:28px;box-shadow:0 4px 20px rgba(0,0,0,.08)}
    .summary-box{background:#eef5ff;border:1px solid #c7dbff;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-size:14px;line-height:1.6;color:#1e3a5f}
    .phase{display:flex;gap:16px;margin-bottom:24px}
    .phase-left{display:flex;flex-direction:column;align-items:center;flex-shrink:0;padding-top:4px}
    .phase-dot{width:36px;height:36px;background:linear-gradient(135deg,#1565c0,#42a5f5);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;flex-shrink:0}
    .phase-body{flex:1}
    .phase-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}
    .phase-head h2{font-size:17px;font-weight:700;color:#1e3a5f}
    .dur{background:#eef5ff;color:#1565c0;border:1px solid #c7dbff;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;white-space:nowrap}
    .phase-desc{color:#64748b;font-size:13px;margin-bottom:12px;line-height:1.6}
    .tasks{display:flex;flex-direction:column;gap:8px}
    .task{background:#f8fbff;border:1px solid #e8eef7;border-radius:10px;overflow:hidden}
    .task-done{background:#f0fdf4;border-color:#bbf7d0}
    .task-top{display:flex;align-items:flex-start;gap:10px;padding:10px 14px}
    .chk{font-size:16px;color:#cbd5e1;flex-shrink:0;margin-top:1px}
    .task-done .chk{color:#10b981}
    .task-info{flex:1}
    .task-title{display:block;font-size:14px;font-weight:600;color:#1e3a5f}
    .task-done .task-title{text-decoration:line-through;color:#94a3b8}
    .task-dur{font-size:12px;color:#94a3b8}
    .task-body{padding:0 14px 12px 40px}
    .task-desc{color:#475569;font-size:13px;line-height:1.7;margin-bottom:10px}
    .res-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .res-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px}
    .res-chip{display:inline-flex;align-items:center;background:#eef5ff;color:#1565c0;border:1px solid #c7dbff;border-radius:20px;padding:4px 10px;font-size:12px;text-decoration:none}
    .res-chip:hover{background:#1565c0;color:#fff}
    .footer{text-align:center;margin-top:24px;font-size:12px;color:#94a3b8}
    @media(max-width:600px){.phase{flex-direction:column}.strip{flex-direction:column}}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escHtml(roadmap.track)} Roadmap — EduPick</title>
  <style>${css}</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-top">
      <h1>${escHtml(roadmap.track)}</h1>
      <span class="level-tag">${escHtml(roadmap.level)}</span>
    </div>
    <div class="header-meta">Generated by EduPick · ${date}</div>
    <p class="goal-text"><strong>Goal:</strong> ${escHtml(roadmap.goal)}</p>
  </div>
  <div class="strip">
    <div class="strip-item">
      <div class="strip-label">Duration</div>
      <div class="strip-value">${escHtml(roadmap.total_duration)}</div>
    </div>
    <div class="strip-item">
      <div class="strip-label">Phases</div>
      <div class="strip-value">${phases.length}</div>
    </div>
    <div class="strip-item" style="flex:2">
      <div class="strip-label">Progress — ${progress}%</div>
      <div class="prog-bar"><div class="prog-fill" style="width:${progress}%"></div></div>
      <div style="font-size:12px;margin-top:4px;opacity:.75">${done} / ${total} tasks completed</div>
    </div>
  </div>
  <div class="content">
    <div class="summary-box">${escHtml(roadmap.summary)}</div>
    ${phasesHTML}
  </div>
  <div class="footer">Generated with EduPick · edupick.app</div>
</div>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
export default function Roadmap() {
  const location       = useLocation();
  const navigate       = useNavigate();
  const suggestedTrack = location.state?.suggestedTrack || "";
  const email          = localStorage.getItem("userEmail") || "";

  const roadmapId      = location.state?.roadmapId || null;
  const cvRoadmap      = location.state?.cvRoadmap || null;  // from CV Analyzer handoff

  const [stage,  setStage]  = useState(cvRoadmap ? "roadmap" : roadmapId ? "loading" : "form");
  const [form,   setForm]   = useState({
    track: cvRoadmap?.track || suggestedTrack,
    level: cvRoadmap?.level || "beginner",
    goal:  cvRoadmap?.goal  || "",
  });
  const [savedId, setSavedId] = useState(roadmapId);
  const [interviewTracks, setInterviewTracks] = useState(location.state?.suggestedTracks || []);
  const [hasInterview, setHasInterview] = useState(location.state?.fromInterview || false);

  // Load a saved roadmap when opened from the dashboard / profile
  useEffect(() => {
    if (!roadmapId) return;
    setStage("loading");
    fetch(`${API_URL}/roadmap/get?roadmap_id=${encodeURIComponent(roadmapId)}&email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => {
        if (d.roadmap) {
          setRoadmap(d.roadmap);
          setForm({
            track: d.roadmap.track || "",
            level: d.roadmap.level || "beginner",
            goal:  d.roadmap.goal || "",
          });
          setSavedId(d.roadmap.roadmap_id || roadmapId);
          setStage("roadmap");
        } else {
          setStage("form");
        }
      })
      .catch(() => setStage("form"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmapId]);

  // Pull interview suggestions if we didn't arrive straight from the interview
  useEffect(() => {
    if (!email || location.state?.fromInterview) return;
    fetch(`${API_URL}/interview/latest?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => {
        setHasInterview(!!d.has_interview);
        if (d.suggested_tracks?.length) setInterviewTracks(d.suggested_tracks);
      })
      .catch(() => {});
  }, [email, location.state]);
  const [roadmap, setRoadmap]             = useState(cvRoadmap || null);
  const [loading, setLoading]             = useState(false);
  const [error,   setError]               = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText,      setNoteText]      = useState("");
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ── Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!form.track.trim()) return setError("Please enter a track or subject.");
    if (!form.goal.trim())  return setError("Please describe your goal.");
    setError(""); setLoading(true); setStage("loading");
    try {
      const res  = await fetch(`${API_URL}/roadmap`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      setRoadmap(data.roadmap);
      setStage("roadmap");
    } catch (e) {
      setError(e.message || "Could not reach the server.");
      setStage("form");
    } finally { setLoading(false); }
  };

  // ── Regenerate ────────────────────────────────────────────
  const handleRegenerate = async () => {
    setActionLoading(true); setSaveMsg(""); setError("");
    try {
      const res  = await fetch(`${API_URL}/roadmap/regenerate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setRoadmap(data.roadmap);
    } catch (e) { setError(e.message || "Regeneration failed"); }
    finally { setActionLoading(false); }
  };

  // ── Regenerate with note ──────────────────────────────────
  const handleRegenerateWithNote = async () => {
    setShowNoteModal(false); setActionLoading(true); setSaveMsg(""); setError("");
    try {
      const res  = await fetch(`${API_URL}/roadmap/regenerate-with-note`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, note: noteText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setRoadmap(data.roadmap); setNoteText("");
    } catch (e) { setError(e.message || "Regeneration failed"); }
    finally { setActionLoading(false); }
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!email) return setSaveMsg("Log in to save your roadmaps.");
    setSaving(true); setSaveMsg("");
    try {
      if (savedId) {
        // Update the existing saved roadmap
        const res = await fetch(`${API_URL}/roadmap/progress`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, roadmap_id: savedId, roadmap }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error);
        setSaveMsg("Progress saved!");
      } else {
        const res = await fetch(`${API_URL}/roadmap/save`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, roadmap }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error);
        if (data.saved_id) setSavedId(data.saved_id);
        setSaveMsg("Roadmap saved successfully!");
      }
    } catch (e) { setSaveMsg("Save failed: " + (e.message || "unknown error")); }
    finally { setSaving(false); }
  };

  // Persist progress to the saved roadmap (best-effort).
  const persistProgress = (updated) => {
    if (savedId && email) {
      fetch(`${API_URL}/roadmap/progress`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roadmap_id: savedId, roadmap: updated }),
      }).catch(() => {});
    }
  };

  // Toggle a topic; if this is an already-saved roadmap, persist the change.
  const handleToggleTask = (pi, ti) => setRoadmap(prev => {
    const updated = toggleTask(prev, pi, ti);
    persistProgress(updated);
    return updated;
  });

  // Toggle a phase's practical project.
  const handleToggleProject = (pi) => setRoadmap(prev => {
    const updated = toggleProject(prev, pi);
    persistProgress(updated);
    return updated;
  });

  // ── Share as HTML download ────────────────────────────────
  const handleShare = () => {
    const html     = generateShareHTML(roadmap);
    const blob     = new Blob([html], { type: "text/html" });
    const url      = URL.createObjectURL(blob);
    const anchor   = document.createElement("a");
    anchor.href    = url;
    anchor.download = `${(roadmap.track || "roadmap").replace(/\s+/g, "-").toLowerCase()}-edupick.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // ══════════════════════════════════════════════════════════
  if (stage === "loading") return <LoadingScreen />;

  if (stage === "roadmap" && roadmap) return (
    <RoadmapScreen
      roadmap={roadmap} form={form} progress={calcProgress(roadmap.phases)}
      actionLoading={actionLoading} saving={saving} saveMsg={saveMsg} error={error}
      showNoteModal={showNoteModal} noteText={noteText}
      onToggleTask={handleToggleTask}
      onToggleProject={handleToggleProject}
      onRegenerate={handleRegenerate}
      onOpenNote={() => setShowNoteModal(true)}
      onCloseNote={() => setShowNoteModal(false)}
      onNoteChange={setNoteText}
      onRegenerateWithNote={handleRegenerateWithNote}
      onSave={handleSave}
      onPrint={() => window.print()}
      onShare={handleShare}
      onBack={() => setStage("form")}
    />
  );

  // ── Form ──────────────────────────────────────────────────
  return (
    <div className="rm-page">
      <div className="rm-form-card">
        <div className="rm-form-header">
          <div className="rm-form-icon"><FaGraduationCap /></div>
          <h1>Build Your Roadmap</h1>
          <p>Tell us about your learning goals and we'll craft a personalized action plan.</p>
        </div>

        {suggestedTrack && (
          <div className="rm-autofill-note">
            Track auto-filled from your Track Discovery interview.
          </div>
        )}

        {interviewTracks.length > 0 && (
          <div className="rm-suggest-box">
            <span className="rm-suggest-label">✨ From your interview — pick a recommended track:</span>
            <div className="rm-suggest-chips">
              {interviewTracks.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className={`rm-suggest-chip${form.track === t.name ? " active" : ""}`}
                  onClick={() => setForm(f => ({ ...f, track: t.name }))}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasInterview && !suggestedTrack && (
          <div className="rm-nudge">
            <span>Not sure which track to pick? A 4-question interview can recommend one for you.</span>
            <button type="button" className="rm-nudge-btn" onClick={() => navigate("/discover")}>
              Take the interview →
            </button>
          </div>
        )}

        <div className="rm-field">
          <label>Track / Subject</label>
          <input
            type="text"
            placeholder="e.g. Web Development, Data Science, UI/UX Design"
            value={form.track}
            onChange={e => setForm(f => ({ ...f, track: e.target.value }))}
          />
        </div>

        <div className="rm-field">
          <label>Current Level</label>
          <div className="rm-level-options">
            {["beginner", "intermediate", "advanced"].map(lv => (
              <button
                key={lv}
                className={`rm-level-btn${form.level === lv ? " active" : ""}`}
                onClick={() => setForm(f => ({ ...f, level: lv }))}
              >
                {lv.charAt(0).toUpperCase() + lv.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="rm-field">
          <label>Your Goal</label>
          <textarea
            placeholder="e.g. Get a job as a full-stack developer, prepare for a career change, build my first app…"
            value={form.goal}
            onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
            rows={3}
          />
        </div>

        {error && <p className="rm-error">{error}</p>}

        <button className="rm-generate-btn" onClick={handleGenerate} disabled={loading}>
          {loading ? <FaSpinner className="rm-spin" /> : <FaGraduationCap />}
          Generate My Roadmap
        </button>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="rm-loading-page">
      <div className="rm-loading-card">
        <FaSpinner className="rm-spin-large" />
        <h2>Building your personalized roadmap…</h2>
        <p>Analyzing your profile, designing phases &amp; topics, curating real course links, and writing a 10-question quiz and a hands-on project for each phase. This can take up to a minute.</p>
        <div className="rm-dots"><span /><span /><span /></div>
      </div>
    </div>
  );
}

// ── Roadmap screen ────────────────────────────────────────────
function RoadmapScreen({
  roadmap, form, progress, actionLoading, saving, saveMsg, error,
  showNoteModal, noteText,
  onToggleTask, onToggleProject, onRegenerate, onOpenNote, onCloseNote,
  onNoteChange, onRegenerateWithNote, onSave, onPrint, onShare, onBack,
}) {
  const hint = roadmap.display_hint || "timeline";
  const [view, setView] = useState(hint);
  const [quizPhase, setQuizPhase] = useState(null);

  return (
    <div className="rm-roadmap-page">
      {/* Header */}
      <div className="rm-roadmap-header rm-no-print">
        <button className="rm-back-btn" onClick={onBack}><FaArrowLeft /> Back</button>
        <div className="rm-header-info">
          <h1 className="rm-header-track">{roadmap.track}</h1>
          <span className="rm-level-tag">{roadmap.level}</span>
        </div>
        <div className="rm-action-bar">
          {actionLoading && <FaSpinner className="rm-spin rm-spin-sm" />}
          <button className="rm-action-btn rm-btn-outline" onClick={onRegenerate} disabled={actionLoading}>
            <FaRedo /> Regenerate
          </button>
          <button className="rm-action-btn rm-btn-outline" onClick={onOpenNote} disabled={actionLoading}>
            <FaPencilAlt /> Add Note
          </button>
          <button className="rm-action-btn rm-btn-primary" onClick={onSave} disabled={saving}>
            <FaSave /> {saving ? "Saving…" : "Save"}
          </button>
          <button className="rm-action-btn rm-btn-outline" onClick={onShare}>
            <FaShareAlt /> Share HTML
          </button>
          <button className="rm-action-btn rm-btn-outline" onClick={onPrint}>
            <FaPrint /> Print
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="rm-summary-strip">
        <div className="rm-summary-item">
          <span className="rm-summary-label">Total Duration</span>
          <span className="rm-summary-value">{roadmap.total_duration}</span>
        </div>
        <div className="rm-summary-item">
          <span className="rm-summary-label">Phases</span>
          <span className="rm-summary-value">{roadmap.phases.length}</span>
        </div>
        <div className="rm-summary-item rm-progress-item">
          <span className="rm-summary-label">Progress — {progress}%</span>
          <div className="rm-prog-bar">
            <div className="rm-prog-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="rm-content">
        <div className="rm-goal-card">
          <strong>Goal:</strong> {roadmap.goal}
          <p className="rm-summary-p">{roadmap.summary}</p>
        </div>

        {error   && <p className="rm-error rm-no-print">{error}</p>}
        {saveMsg && (
          <p className={`rm-save-msg rm-no-print${saveMsg.includes("fail") || saveMsg.includes("Log") ? " rm-save-err" : ""}`}>
            {saveMsg}
          </p>
        )}

        {/* View switcher */}
        <div className="rm-view-switcher rm-no-print">
          {["timeline", "checklist", "kanban"].map(v => (
            <button
              key={v}
              className={`rm-view-btn${view === v ? " active" : ""}`}
              onClick={() => setView(v)}
            >
              {v === "timeline" ? "Timeline" : v === "checklist" ? "Checklist" : "Kanban"}
            </button>
          ))}
        </div>

        {view === "checklist"
          ? <ChecklistView phases={roadmap.phases} onToggleTask={onToggleTask} onToggleProject={onToggleProject} onTakeQuiz={setQuizPhase} />
          : view === "kanban"
          ? <KanbanView    phases={roadmap.phases} onToggleTask={onToggleTask} onToggleProject={onToggleProject} onTakeQuiz={setQuizPhase} />
          : <TimelineView  phases={roadmap.phases} onToggleTask={onToggleTask} onToggleProject={onToggleProject} onTakeQuiz={setQuizPhase} />
        }
      </div>

      {/* Per-phase quiz modal */}
      {quizPhase && (
        <PhaseQuizModal
          phase={quizPhase}
          track={roadmap.track}
          onClose={() => setQuizPhase(null)}
        />
      )}

      {/* Note modal */}
      {showNoteModal && (
        <div className="rm-overlay" onClick={onCloseNote}>
          <div className="rm-modal" onClick={e => e.stopPropagation()}>
            <div className="rm-modal-head">
              <h3>Customize Regeneration</h3>
              <button className="rm-modal-close" onClick={onCloseNote}><FaTimes /></button>
            </div>
            <p className="rm-modal-hint">Describe how you'd like the roadmap adjusted.</p>
            <textarea
              className="rm-modal-ta"
              placeholder="e.g. Focus more on backend. Skip HTML basics. Add more practical projects."
              value={noteText}
              onChange={e => onNoteChange(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="rm-modal-foot">
              <button className="rm-action-btn rm-btn-outline" onClick={onCloseNote}>Cancel</button>
              <button className="rm-action-btn rm-btn-primary" onClick={onRegenerateWithNote}>
                <FaRedo /> Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Timeline view ─────────────────────────────────────────────
function TimelineView({ phases, onToggleTask, onToggleProject, onTakeQuiz }) {
  return (
    <div className="rm-timeline">
      {phases.map((phase, pi) => (
        <div key={pi} className="rm-phase">
          <div className="rm-phase-connector">
            <div className="rm-phase-dot">{phase.phase_number}</div>
            {pi < phases.length - 1 && <div className="rm-phase-line" />}
          </div>
          <div className="rm-phase-body">
            <div className="rm-phase-head">
              <h2 className="rm-phase-title">{phase.title}</h2>
              <span className="rm-phase-dur">{phase.duration}</span>
            </div>
            <p className="rm-phase-desc">{phase.description}</p>
            <span className="rm-topics-label">Topics</span>
            <div className="rm-tasks">
              {phase.tasks.map((task, ti) => (
                <TaskCard key={ti} task={task} onToggle={() => onToggleTask(pi, ti)} />
              ))}
            </div>
            <PhaseProjectCard project={phase.project} onToggle={() => onToggleProject(pi)} />
            {phase.quiz?.length > 0 && (
              <button className="rm-phase-quiz-btn rm-no-print" onClick={() => onTakeQuiz(phase)}>
                <FaQuestionCircle /> Take phase quiz ({phase.quiz.length} Qs)
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Kanban view ───────────────────────────────────────────────
function KanbanView({ phases, onToggleTask, onToggleProject, onTakeQuiz }) {
  return (
    <div className="rm-kanban">
      {phases.map((phase, pi) => {
        const total = phase.tasks?.length || 0;
        const done  = phase.tasks?.filter(t => t.completed).length || 0;
        const pct   = total ? Math.round((done / total) * 100) : 0;
        return (
          <div key={pi} className="rm-kanban-col">
            <div className="rm-kanban-col-head">
              <span className="rm-kanban-num">{phase.phase_number}</span>
              <div className="rm-kanban-col-info">
                <span className="rm-kanban-col-name" title={phase.title}>{phase.title}</span>
                <span className="rm-kanban-col-dur">{phase.duration}</span>
              </div>
              <span className="rm-kanban-badge">{done}/{total}</span>
            </div>
            <div className="rm-kanban-col-bar">
              <div className="rm-kanban-col-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="rm-kanban-cards">
              {(phase.tasks || []).map((task, ti) => (
                <div
                  key={ti}
                  className={`rm-kc${task.completed ? " rm-kc--done" : ""}`}
                  onClick={() => onToggleTask(pi, ti)}
                  title="Click to toggle completion"
                >
                  <div className="rm-kc-chk">
                    {task.completed
                      ? <FaCheckCircle className="rm-chk-on" />
                      : <FaCircle      className="rm-chk-off" />
                    }
                  </div>
                  <div className="rm-kc-body">
                    <span className="rm-kc-title">{task.title}</span>
                    <span className="rm-kc-dur">{task.duration}</span>
                  </div>
                </div>
              ))}
            </div>
            <PhaseProjectCard project={phase.project} onToggle={() => onToggleProject(pi)} compact />
            {phase.quiz?.length > 0 && (
              <button className="rm-phase-quiz-btn rm-phase-quiz-btn--sm" onClick={() => onTakeQuiz(phase)}>
                <FaQuestionCircle /> Quiz
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Checklist view ────────────────────────────────────────────
function ChecklistView({ phases, onToggleTask, onToggleProject, onTakeQuiz }) {
  const [open, setOpen] = useState(() => phases.map(() => true));
  const toggle = idx => setOpen(prev => prev.map((v, i) => i === idx ? !v : v));

  return (
    <div className="rm-checklist">
      {phases.map((phase, pi) => (
        <div key={pi} className="rm-cl-phase">
          <button className="rm-cl-header" onClick={() => toggle(pi)}>
            <span className="rm-cl-num">{phase.phase_number}</span>
            <div className="rm-cl-header-text">
              <span className="rm-cl-title">{phase.title}</span>
              <span className="rm-cl-dur">{phase.duration}</span>
            </div>
            {open[pi] ? <FaChevronUp /> : <FaChevronDown />}
          </button>
          {open[pi] && (
            <div className="rm-cl-tasks">
              {phase.tasks.map((task, ti) => (
                <TaskCard key={ti} task={task} onToggle={() => onToggleTask(pi, ti)} />
              ))}
              <PhaseProjectCard project={phase.project} onToggle={() => onToggleProject(pi)} />
              {phase.quiz?.length > 0 && (
                <button className="rm-phase-quiz-btn rm-no-print" onClick={() => onTakeQuiz(phase)}>
                  <FaQuestionCircle /> Take phase quiz ({phase.quiz.length} Qs)
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Per-phase quiz modal ──────────────────────────────────────
function PhaseQuizModal({ phase, track, onClose }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const email = localStorage.getItem("userEmail") || "";
  const questions = phase.quiz || [];

  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0);
  const total = questions.length;
  const pct   = total ? Math.round((score / total) * 100) : 0;
  const answered = Object.keys(answers).length;

  const submit = async () => {
    setSubmitted(true);
    if (!email) return;
    setSaveState("saving");
    try {
      await fetch(`${API_URL}/topic-quiz/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, topic: phase.title, score, total, lang: "en",
          name: `${track} — ${phase.title}`, source: "roadmap", track,
        }),
      });
      setSaveState("saved");
    } catch { setSaveState("idle"); }
  };

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-modal rm-quiz-modal" onClick={e => e.stopPropagation()}>
        <div className="rm-modal-head">
          <h3>Phase Quiz — {phase.title}</h3>
          <button className="rm-modal-close" onClick={onClose}><FaTimes /></button>
        </div>

        {!submitted ? (
          <>
            <div className="rm-quiz-body">
              {questions.map((q, i) => (
                <div key={i} className="rm-quiz-q">
                  <p className="rm-quiz-qtext"><strong>{i + 1}.</strong> {q.question}</p>
                  <div className="rm-quiz-opts">
                    {Object.entries(q.options || {}).map(([key, text]) => (
                      <button
                        key={key}
                        className={`rm-quiz-opt${answers[i] === key ? " selected" : ""}`}
                        onClick={() => setAnswers(a => ({ ...a, [i]: key }))}
                      >
                        <span className="rm-quiz-key">{key}</span> {text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="rm-modal-foot">
              <span className="rm-quiz-count">{answered}/{total} answered</span>
              <button className="rm-action-btn rm-btn-primary" onClick={submit} disabled={answered < total}>
                Submit
              </button>
            </div>
          </>
        ) : (
          <div className="rm-quiz-result">
            <div className="rm-quiz-score">{pct}%</div>
            <p>You scored <strong>{score}/{total}</strong>.</p>
            {questions.map((q, i) => {
              const ok = answers[i] === q.answer;
              return (
                <div key={i} className={`rm-quiz-review ${ok ? "ok" : "no"}`}>
                  <span>{q.question}</span>
                  {!ok && <span className="rm-quiz-correct">Correct: {q.answer}) {q.options?.[q.answer]}</span>}
                </div>
              );
            })}
            <p className="rm-quiz-saved">
              {saveState === "saved" ? "✓ Saved to your quiz history."
                : saveState === "saving" ? "Saving…"
                : email ? "" : "Log in to save this result."}
            </p>
            <div className="rm-modal-foot">
              <button className="rm-action-btn rm-btn-outline" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Phase project card (the one practical task per phase) ─────
function PhaseProjectCard({ project, onToggle, compact }) {
  if (!project || !project.title) return null;
  return (
    <div className={`rm-project${project.completed ? " rm-project-done" : ""}${compact ? " rm-project-compact" : ""}`}>
      <div className="rm-project-head">
        <button className="rm-checkbox" onClick={onToggle} title="Mark project complete">
          {project.completed
            ? <FaCheckCircle className="rm-chk-on" />
            : <FaCircle      className="rm-chk-off" />}
        </button>
        <span className="rm-project-badge"><FaLaptopCode /> Phase Project</span>
        {project.estimated_hours > 0 && (
          <span className="rm-project-hours">~{project.estimated_hours}h</span>
        )}
      </div>
      <h4 className="rm-project-title">{project.title}</h4>
      {!compact && <p className="rm-project-desc">{project.description}</p>}
      {!compact && project.deliverable && (
        <p className="rm-project-deliverable">
          <strong>Deliverable:</strong> {project.deliverable}
        </p>
      )}
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────
function TaskCard({ task, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rm-task${task.completed ? " rm-task-done" : ""}`}>
      <div className="rm-task-top">
        <button className="rm-checkbox" onClick={onToggle} title="Mark complete">
          {task.completed
            ? <FaCheckCircle className="rm-chk-on" />
            : <FaCircle      className="rm-chk-off" />
          }
        </button>
        <div className="rm-task-info" onClick={() => setExpanded(e => !e)} style={{ cursor: "pointer" }}>
          <span className="rm-task-title">{task.title}</span>
          <span className="rm-task-dur">{task.duration}</span>
        </div>
        <button className="rm-expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? <FaChevronUp /> : <FaChevronDown />}
        </button>
      </div>

      {expanded && (
        <div className="rm-task-detail">
          <p className="rm-task-desc">{task.description}</p>
          {task.resources?.length > 0 && (
            <div className="rm-resources">
              <span className="rm-res-label">Resources</span>
              <div className="rm-res-list">
                {task.resources.map((res, ri) => (
                  <a
                    key={ri}
                    href={res.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="rm-res-chip"
                  >
                    {RESOURCE_ICONS[res.type] || <FaLink />}
                    {res.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
