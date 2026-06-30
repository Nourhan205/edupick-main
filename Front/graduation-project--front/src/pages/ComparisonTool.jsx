import React, { useState, useEffect } from 'react';
import { API_URL } from "../config";
import { useNavigate } from 'react-router-dom';
import '../styles/ComparisonTool.css';

// ── Translations ──────────────────────────────────────────────
const T = {
  en: {
    title:        "Career Comparison Tool",
    subtitle:     "Compare learning tracks side by side with live web data",
    tracksLabel:  "Tracks to compare",
    trackPlaceholder: "e.g. Web Development",
    addTrack:     "+ Add Track",
    minTracks:    "At least 2 tracks required",
    locationLabel:    "Location",
    locationPlaceholder: "e.g. Egypt",
    currencyLabel:    "Currency",
    currencyPlaceholder: "e.g. EGP",
    yearLabel:        "Year",
    yearPlaceholder:  "e.g. 2026",
    criteriaLabel:    "Criteria",
    allCriteria:      "All",
    compareBtn:       "Compare",
    loadingTitle:     "Analyzing tracks…",
    loadingNote:      "Searching the web for live data. This may take 30–60 seconds.",
    resultTitle:      "Comparison Results",
    placeholder:      "Enter tracks above and click Compare",
    error:            "Something went wrong. Please try again.",
    insights:         "Key Insights",
    highestSalary:    "Highest Salary",
    fastestGrowing:   "Fastest Growing",
    easiestStart:     "Easiest to Start",
    summary:          "Summary",
    source:           "Source",
    createRoadmap:    "Create Roadmap",
    criteria: {
      "1": "Required Skills",
      "2": "Average Salary",
      "3": "Learning Duration",
      "4": "Market Demand",
      "5": "Difficulty Level",
      "6": "Job Opportunities",
      "7": "Alternative Paths",
    },
  },
  ar: {
    title:        "أداة مقارنة المسارات",
    subtitle:     "قارن المسارات المهنية جنب لجنب بناءً على بيانات حية من الإنترنت",
    tracksLabel:  "المسارات للمقارنة",
    trackPlaceholder: "مثال: تطوير الويب",
    addTrack:     "+ إضافة مسار",
    minTracks:    "مطلوب مسارَين على الأقل",
    locationLabel:    "الموقع",
    locationPlaceholder: "مثال: مصر",
    currencyLabel:    "العملة",
    currencyPlaceholder: "مثال: EGP",
    yearLabel:        "السنة",
    yearPlaceholder:  "مثال: 2026",
    criteriaLabel:    "المعايير",
    allCriteria:      "الكل",
    compareBtn:       "قارن",
    loadingTitle:     "جارى تحليل المسارات…",
    loadingNote:      "يتم البحث على الإنترنت. قد يستغرق ذلك ٣٠–٦٠ ثانية.",
    resultTitle:      "نتيجة المقارنة",
    placeholder:      "أدخل المسارات واضغط قارن",
    error:            "حصل خطأ، حاول تاني.",
    insights:         "أبرز النتائج",
    highestSalary:    "الأعلى راتباً",
    fastestGrowing:   "الأسرع نمواً",
    easiestStart:     "الأسهل للبدء",
    summary:          "ملخص",
    source:           "المصدر",
    createRoadmap:    "إنشاء خارطة طريق",
    criteria: {
      "1": "المهارات المطلوبة",
      "2": "متوسط الراتب",
      "3": "مدة التعلم",
      "4": "الطلب في السوق",
      "5": "مستوى الصعوبة",
      "6": "فرص العمل",
      "7": "المسارات البديلة",
    },
  },
};

const ALL_CRITERIA_KEYS = ["1", "2", "3", "4", "5", "6", "7"];

// ── JSON parser ───────────────────────────────────────────────
function parseResult(raw) {
  if (!raw) return null;
  let text = raw.trim()
    .replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    .replace(/^```\s*/,       '').replace(/\s*```$/,  '')
    .trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const data = JSON.parse(match[0]);
      if ((data.rows || data.comparison) && data.tracks) return { type: 'json', data };
    } catch {}
  }

  // Markdown table fallback
  if (text.includes('|')) return { type: 'markdown', raw: text };

  return { type: 'text', raw: text };
}

// ══════════════════════════════════════════════════════════════
export default function ComparisonTool() {
  const navigate = useNavigate();

  const [lang,      setLang]      = useState('en');
  const [trackList, setTrackList] = useState(['', '']);
  const [location,  setLocation]  = useState('');
  const [currency,  setCurrency]  = useState('');
  const [year,      setYear]      = useState('');
  const [criteria,  setCriteria]  = useState([]);
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [interviewTracks, setInterviewTracks] = useState([]);

  const t = T[lang];
  const email = localStorage.getItem('userEmail') || '';

  // ── Load interview track suggestions ──────────────────────
  useEffect(() => {
    if (!email) return;
    fetch(`${API_URL}/interview/latest?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { if (d.suggested_tracks?.length) setInterviewTracks(d.suggested_tracks); })
      .catch(() => {});
  }, [email]);

  // ── Track list handlers ───────────────────────────────────
  const updateTrack = (i, val) =>
    setTrackList(prev => prev.map((t, j) => (j === i ? val : t)));
  const addTrack    = () => setTrackList(prev => [...prev, '']);
  const removeTrack = (i) => setTrackList(prev => prev.filter((_, j) => j !== i));

  // Fill the track inputs with all interview-suggested tracks at once
  const useInterviewTracks = () => {
    const names = interviewTracks.map(t => t.name).slice(0, 4);
    setTrackList(names.length >= 2 ? names : [...names, ...Array(2 - names.length).fill('')]);
  };

  const filledTracks = trackList.filter(t => t.trim());

  // ── Criteria toggle ───────────────────────────────────────
  const toggleCriteria = (key) => {
    if (key === 'all') {
      setCriteria(prev =>
        prev.length === ALL_CRITERIA_KEYS.length ? [] : [...ALL_CRITERIA_KEYS]
      );
    } else {
      setCriteria(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    }
  };

  const allSelected = criteria.length === ALL_CRITERIA_KEYS.length;

  // ── Compare ───────────────────────────────────────────────
  const handleCompare = async () => {
    if (filledTracks.length < 2) return;
    setLoading(true); setError(null); setResult(null);

    const tracksStr   = filledTracks.join(', ');
    const criteriaStr = criteria.length
      ? criteria.join(',')
      : ALL_CRITERIA_KEYS.join(',');

    try {
      const res  = await fetch(`${API_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          tracks:   tracksStr,
          location: location || (lang === 'ar' ? 'مصر' : 'Global'),
          currency: (currency.toUpperCase()) || 'USD',
          year:     year || '2026',
          criteria: criteriaStr,
        }),
      });

      if (!res.ok) throw new Error('Server error');

      const data = await res.json();
      setResult(parseResult(data.result));
    } catch (err) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  // ── Create roadmap for a track ────────────────────────────
  const handleCreateRoadmap = (track) => {
    navigate('/roadmap', { state: { suggestedTrack: track } });
  };

  // ── Render result ─────────────────────────────────────────
  const renderResult = () => {
    if (!result) return null;
    const { type, data, raw } = result;

    if (type === 'json') {
      return (
        <ComparisonResult
          data={data} t={t} lang={lang}
          onCreateRoadmap={handleCreateRoadmap}
        />
      );
    }
    if (type === 'markdown') {
      return <MarkdownTable markdown={raw} />;
    }
    return <pre className="raw-result">{raw}</pre>;
  };

  // ════════════════════════════════════════════════════════════
  return (
    <div className={`career-comparison-container ${lang === 'ar' ? 'rtl' : 'ltr'}`}>

      {/* Header */}
      <header className="tool-header">
        <div className="header-top">
          <div>
            <h1>{t.title}</h1>
            <p className="subtitle">{t.subtitle}</p>
          </div>
          <div className="lang-toggle">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')}>AR</button>
          </div>
        </div>
      </header>

      <div className="tool-content">

        {/* ── Left panel — inputs ── */}
        <div className="selection-panel">

          {interviewTracks.length > 0 && (
            <div className="ct-suggest-banner">
              <span className="ct-suggest-text">
                {lang === 'ar'
                  ? '✨ من نتيجة الانترفيو، قارن مساراتك المقترحة:'
                  : '✨ From your interview, compare your suggested tracks:'}
              </span>
              <div className="ct-suggest-chips">
                {interviewTracks.map((tr, i) => (
                  <button key={i} className="ct-suggest-chip"
                    onClick={() => {
                      const empty = trackList.findIndex(x => !x.trim());
                      if (empty !== -1) updateTrack(empty, tr.name);
                      else setTrackList(prev => [...prev, tr.name]);
                    }}>
                    + {tr.name}
                  </button>
                ))}
                <button className="ct-suggest-all" onClick={useInterviewTracks}>
                  {lang === 'ar' ? 'استخدم الكل' : 'Use all'}
                </button>
              </div>
            </div>
          )}

          <div className="input-group">
            <label>{t.tracksLabel}</label>
            <div className="track-inputs">
              {trackList.map((track, i) => (
                <div key={i} className="track-input-row">
                  <span className="track-number">{i + 1}</span>
                  <input
                    type="text"
                    placeholder={`${t.trackPlaceholder} ${i + 1}`}
                    value={track}
                    onChange={e => updateTrack(i, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCompare()}
                  />
                  {trackList.length > 2 && (
                    <button
                      className="remove-track-btn"
                      onClick={() => removeTrack(i)}
                      title="Remove"
                    >×</button>
                  )}
                </div>
              ))}
              {trackList.length < 4 && (
                <button className="add-track-btn" onClick={addTrack}>
                  {t.addTrack}
                </button>
              )}
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>{t.locationLabel}</label>
              <input type="text" placeholder={t.locationPlaceholder}
                value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="input-group">
              <label>{t.currencyLabel}</label>
              <input type="text" placeholder={t.currencyPlaceholder}
                value={currency} onChange={e => setCurrency(e.target.value)} />
            </div>
            <div className="input-group">
              <label>{t.yearLabel}</label>
              <input type="text" placeholder={t.yearPlaceholder}
                value={year} onChange={e => setYear(e.target.value)} />
            </div>
          </div>

          <div className="input-group">
            <label>{t.criteriaLabel}</label>
            <div className="criteria-buttons">
              {/* All button */}
              <button
                className={`criteria-btn${allSelected ? ' selected' : ''}`}
                onClick={() => toggleCriteria('all')}
              >
                {t.allCriteria}
              </button>
              {ALL_CRITERIA_KEYS.map(key => (
                <button
                  key={key}
                  className={`criteria-btn${criteria.includes(key) ? ' selected' : ''}`}
                  onClick={() => toggleCriteria(key)}
                >
                  {t.criteria[key]}
                </button>
              ))}
            </div>
          </div>

          <button
            className="compare-btn"
            onClick={handleCompare}
            disabled={loading || filledTracks.length < 2}
          >
            {loading ? t.loadingTitle : t.compareBtn}
          </button>

        </div>

        {/* ── Right panel — results ── */}
        <div className="comparison-panel">
          <h2>{t.resultTitle}</h2>

          {error && <div className="api-warning">⚠ {error}</div>}

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p className="loading-title">{t.loadingTitle}</p>
              <p className="loading-note">{t.loadingNote}</p>
            </div>
          )}

          {!loading && !result && !error && (
            <div className="comparison-placeholder">
              <div className="placeholder-icon">📊</div>
              <p>{t.placeholder}</p>
            </div>
          )}

          {!loading && renderResult()}
        </div>

      </div>
    </div>
  );
}

// Resolve a track's cell within a criterion row even when the LLM keys it
// slightly differently (case, spacing, partial name) or positionally.
function resolveCell(trackData, track, index) {
  if (!trackData || typeof trackData !== 'object') return {};
  if (trackData[track]) return trackData[track];
  const keys = Object.keys(trackData);
  const norm = (s) => String(s).trim().toLowerCase();
  let key = keys.find((k) => norm(k) === norm(track));
  if (!key) key = keys.find((k) => norm(k).includes(norm(track)) || norm(track).includes(norm(k)));
  if (!key && keys[index] !== undefined) key = keys[index]; // positional fallback
  return key ? (trackData[key] || {}) : {};
}

// ── Structured JSON result ────────────────────────────────────
function ComparisonResult({ data, t, lang, onCreateRoadmap }) {
  const { insights } = data;
  let tracks = Array.isArray(data.tracks) ? data.tracks.filter(Boolean) : [];

  // Normalize to position-based rows: [{ criterion, cells:[{value,source}, ...] }]
  let rows = [];
  if (Array.isArray(data.rows)) {
    rows = data.rows.map(r => ({
      criterion: r.criterion || r.name || '',
      cells: Array.isArray(r.cells) ? r.cells : [],
    }));
  } else if (data.comparison && typeof data.comparison === 'object') {
    // Fallback for the older nested-key schema
    const firstRow = Object.values(data.comparison)[0];
    const rowKeys = firstRow && typeof firstRow === 'object' ? Object.keys(firstRow) : [];
    if (rowKeys.length > tracks.length) tracks = rowKeys;
    rows = Object.entries(data.comparison).map(([criterion, td]) => ({
      criterion,
      cells: tracks.map((tr, i) => resolveCell(td, tr, i)),
    }));
  }

  // Safety: if track names are missing, infer the count from the rows
  if (!tracks.length && rows.length) {
    const n = Math.max(...rows.map(r => r.cells.length));
    tracks = Array.from({ length: n }, (_, i) => `Track ${i + 1}`);
  }

  return (
    <div className="ct-result">

      {/* Insights row */}
      {insights && (
        <div className="ct-insights-section">
          <h3 className="ct-section-title">{t.insights}</h3>
          <div className="ct-insights-row">
            {insights.highest_salary && (
              <InsightCard icon="💰" label={t.highestSalary} value={insights.highest_salary} />
            )}
            {insights.fastest_growing && (
              <InsightCard icon="📈" label={t.fastestGrowing} value={insights.fastest_growing} />
            )}
            {insights.easiest_to_start && (
              <InsightCard icon="🚀" label={t.easiestStart} value={insights.easiest_to_start} />
            )}
          </div>
          {insights.summary && (
            <div className="ct-summary-box">
              <strong>{t.summary}:</strong> {insights.summary}
            </div>
          )}
        </div>
      )}

      {/* Comparison — card grid (one card per track, per criterion) */}
      {rows.length > 0 && tracks.length > 0 && (
        <div className="ct-compare">
          {/* track legend */}
          <div className="ct-legend" style={{ gridTemplateColumns: `repeat(${tracks.length}, minmax(0, 1fr))` }}>
            {tracks.map((track, i) => (
              <div key={i} className={`ct-legend-item ct-legend-${i % 4}`}>
                <span className="ct-legend-dot" />
                <span className="ct-legend-name">{track}</span>
              </div>
            ))}
          </div>

          {rows.map((row, ri) => (
            <div key={ri} className="ct-crit-block">
              <div className="ct-crit-name">{row.criterion}</div>
              <div className="ct-crit-cards" style={{ gridTemplateColumns: `repeat(${tracks.length}, minmax(0, 1fr))` }}>
                {tracks.map((track, ti) => {
                  const cell = row.cells[ti] || {};
                  return (
                    <div key={ti} className={`ct-cell-card ct-legend-${ti % 4}`}>
                      <div className="ct-cell-track">{track}</div>
                      <div className="ct-cell-val">{cell.value || '—'}</div>
                      {cell.source && (
                        <a href={cell.source} target="_blank" rel="noreferrer" className="ct-source-link">
                          {t.source} ↗
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create roadmap buttons */}
      {tracks.length > 0 && (
        <div className="ct-roadmap-row">
          {tracks.map((track, i) => (
            <button key={i} className="ct-roadmap-btn" onClick={() => onCreateRoadmap(track)}>
              🗺 {t.createRoadmap}: {track}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Insight card ──────────────────────────────────────────────
function InsightCard({ icon, label, value }) {
  return (
    <div className="ct-insight-card">
      <span className="ct-insight-icon">{icon}</span>
      <span className="ct-insight-label">{label}</span>
      <span className="ct-insight-value">{value}</span>
    </div>
  );
}

// ── Markdown table fallback ───────────────────────────────────
function MarkdownTable({ markdown }) {
  const lines = markdown.trim().split('\n').filter(l => l.trim());
  const rows  = lines.filter(l => l.startsWith('|'));
  if (rows.length < 2) return <pre className="raw-result">{markdown}</pre>;

  return (
    <div className="comparison-table-container">
      <table className="comparison-table">
        <thead>
          <tr>
            {rows[0].split('|').filter(c => c.trim()).map((cell, i) => (
              <th key={i}>{cell.trim()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(2).map((row, i) => (
            <tr key={i}>
              {row.split('|').filter(c => c.trim()).map((cell, j) => (
                <td key={j}>{cell.trim()}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
