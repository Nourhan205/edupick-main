import React, { useState, useEffect } from 'react';
import { API_URL } from "../config";
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/TopicTest.css';

// ── Translations ────────────────────────────────────────────────
const T = {
  en: {
    title:         "Topic Test",
    subtitle:      "Generate a custom quiz on any topic from your roadmap",
    yourTopics:    "Your Roadmap Topics",
    noRoadmap:     "No saved roadmap yet — type a topic manually below.",
    manualLabel:   "Or enter a topic manually",
    manualPlaceholder: "e.g. React Hooks, Python Classes, SQL JOINs",
    countLabel:    "Number of questions",
    langLabel:     "Language",
    generateBtn:   "Generate Test",
    generating:    "Generating questions…",
    submitBtn:     "Submit Answers",
    prevBtn:       "Previous",
    nextBtn:       "Next",
    question:      "Question",
    of:            "of",
    resultTitle:   "Your Results",
    score:         "Score",
    correct:       "Correct",
    incorrect:     "Incorrect",
    unanswered:    "Unanswered",
    nameLabel:     "Save this result as",
    namePlaceholder: "Enter a name for this test",
    saveBtn:       "Save Result",
    saving:        "Saving…",
    saved:         "Saved!",
    retakeBtn:     "Retake",
    newTestBtn:    "New Test",
    yourAnswer:    "Your answer",
    correctAnswer: "Correct answer",
    notAnswered:   "Not answered",
  },
  ar: {
    title:         "اختبار موضوع",
    subtitle:      "أنشئ اختباراً مخصصاً على أي موضوع من رود مابك",
    yourTopics:    "مواضيع رود مابك",
    noRoadmap:     "لم تحفظ رود ماب بعد — اكتب موضوعاً يدوياً أدناه.",
    manualLabel:   "أو أدخل موضوعاً يدوياً",
    manualPlaceholder: "مثال: React Hooks، كلاسات Python، SQL JOINs",
    countLabel:    "عدد الأسئلة",
    langLabel:     "اللغة",
    generateBtn:   "إنشاء الاختبار",
    generating:    "جارٍ إنشاء الأسئلة…",
    submitBtn:     "تسليم الإجابات",
    prevBtn:       "السابق",
    nextBtn:       "التالي",
    question:      "سؤال",
    of:            "من",
    resultTitle:   "نتيجتك",
    score:         "النتيجة",
    correct:       "صحيح",
    incorrect:     "خاطئ",
    unanswered:    "بدون إجابة",
    nameLabel:     "احفظ النتيجة باسم",
    namePlaceholder: "أدخل اسماً لهذا الاختبار",
    saveBtn:       "حفظ النتيجة",
    saving:        "جارٍ الحفظ…",
    saved:         "تم الحفظ!",
    retakeBtn:     "إعادة الاختبار",
    newTestBtn:    "اختبار جديد",
    yourAnswer:    "إجابتك",
    correctAnswer: "الإجابة الصحيحة",
    notAnswered:   "لم تُجب",
  },
};

const STEPS = { SETUP: 'setup', QUIZ: 'quiz', RESULT: 'result' };

export default function TopicTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillTopic = location.state?.topic || '';

  const [lang,          setLang]          = useState('en');
  const [step,          setStep]          = useState(STEPS.SETUP);
  const [roadmaps,      setRoadmaps]      = useState([]);   // [{roadmap_id, track}]
  const [selectedRoadmapId, setSelectedRoadmapId] = useState(null);
  const [roadmapDetail, setRoadmapDetail] = useState(null); // {track, phases:[...]}
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(prefillTopic);
  const [manualTopic,   setManualTopic]   = useState('');
  const [count,         setCount]         = useState(10);
  const [questions,     setQuestions]     = useState([]);
  const [answers,       setAnswers]       = useState({});
  const [currentQ,     setCurrentQ]       = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [testName,      setTestName]      = useState('');
  const [saveState,     setSaveState]     = useState('idle'); // idle | saving | saved

  const t        = T[lang];
  const isRtl    = lang === 'ar';
  const email    = localStorage.getItem('userEmail') || '';
  const topic    = selectedTopic || manualTopic.trim();

  // ── Load the user's roadmaps (id + track) ─────────────────────
  useEffect(() => {
    if (!email) return;
    fetch(`${API_URL}/roadmap/user?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => {
        const list = (d.roadmaps || [])
          .filter(rm => rm.roadmap_id && rm.track)
          .map(rm => ({ roadmap_id: rm.roadmap_id, track: rm.track }));
        setRoadmaps(list);
      })
      .catch(() => {});
  }, [email]);

  // ── Open a roadmap → fetch its phases + topics ────────────────
  const selectRoadmap = (rm) => {
    if (selectedRoadmapId === rm.roadmap_id) {
      setSelectedRoadmapId(null);
      setRoadmapDetail(null);
      return;
    }
    setSelectedRoadmapId(rm.roadmap_id);
    setRoadmapDetail(null);
    setLoadingDetail(true);
    fetch(`${API_URL}/roadmap/get?roadmap_id=${encodeURIComponent(rm.roadmap_id)}&email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { if (d.roadmap) setRoadmapDetail(d.roadmap); })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  };

  const pickTopic = (value) => {
    setSelectedTopic(prev => prev === value ? '' : value);
    setManualTopic('');
  };

  // ── Generate questions ────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setError('');
    setQuestions([]);
    setAnswers({});
    setCurrentQ(0);

    try {
      const res = await fetch(`${API_URL}/topic-quiz/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ topic, count, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setQuestions(data.questions || []);
      setTestName(topic);
      setStep(STEPS.QUIZ);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Submit answers ────────────────────────────────────────────
  const handleSubmit = () => setStep(STEPS.RESULT);

  // ── Score calculation ─────────────────────────────────────────
  const score = questions.reduce((acc, q, i) => {
    return acc + (answers[i] === q.answer ? 1 : 0);
  }, 0);
  const total     = questions.length;
  const pct       = total ? Math.round((score / total) * 100) : 0;
  const answered  = Object.keys(answers).length;
  const unanswered = total - answered;

  // ── Save result ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!email) return;
    setSaveState('saving');
    try {
      await fetch(`${API_URL}/topic-quiz/save`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, topic, score, total, lang, name: testName }),
      });
      setSaveState('saved');
    } catch {
      setSaveState('idle');
    }
  };

  const handleReset = () => {
    setStep(STEPS.SETUP);
    setQuestions([]);
    setAnswers({});
    setCurrentQ(0);
    setSaveState('idle');
    setError('');
  };

  // ════════════════════════════════════════════════════════════════
  return (
    <div className={`tt-page ${isRtl ? 'rtl' : 'ltr'}`}>

      {/* ── Header ── */}
      <header className="tt-header">
        <div className="tt-header-inner">
          <div>
            <h1 className="tt-title">{t.title}</h1>
            <p className="tt-subtitle">{t.subtitle}</p>
          </div>
          <div className="tt-lang-toggle">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')}>AR</button>
          </div>
        </div>
      </header>

      {/* ── Step: SETUP ── */}
      {step === STEPS.SETUP && (
        <div className="tt-setup">

          {/* Pick a roadmap → see its phases & topics */}
          {roadmaps.length > 0 && (
            <section className="tt-section">
              <h2 className="tt-section-title">{lang === 'ar' ? 'اختر رود ماب' : 'Choose a roadmap'}</h2>
              <div className="tt-chips">
                {roadmaps.map((rm) => (
                  <button
                    key={rm.roadmap_id}
                    className={`tt-chip tt-chip--track ${selectedRoadmapId === rm.roadmap_id ? 'active' : ''}`}
                    onClick={() => selectRoadmap(rm)}
                  >
                    🗺️ {rm.track}
                  </button>
                ))}
              </div>

              {/* Phases + topics of the selected roadmap */}
              {selectedRoadmapId && (
                <div className="tt-roadmap-detail">
                  {loadingDetail && <p className="tt-detail-loading">{lang === 'ar' ? 'جارٍ تحميل المواضيع…' : 'Loading topics…'}</p>}

                  {roadmapDetail?.phases?.map((phase, pi) => (
                    <div key={pi} className="tt-phase">
                      <div className="tt-phase-head">
                        <span className="tt-phase-num">{phase.phase_number || pi + 1}</span>
                        <span className="tt-phase-title">{phase.title}</span>
                        <button
                          className={`tt-phase-quiz ${selectedTopic === phase.title ? 'active' : ''}`}
                          onClick={() => pickTopic(phase.title)}
                        >
                          {lang === 'ar' ? 'اختبر المرحلة' : 'Quiz phase'}
                        </button>
                      </div>
                      <div className="tt-chips tt-topic-chips">
                        {(phase.tasks || []).map((task, ti) => (
                          <button
                            key={ti}
                            className={`tt-chip ${selectedTopic === task.title ? 'active' : ''}`}
                            onClick={() => pickTopic(task.title)}
                          >
                            {task.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {roadmapDetail && !roadmapDetail.phases?.length && (
                    <p className="tt-detail-loading">{lang === 'ar' ? 'لا توجد مواضيع في هذه الرود ماب.' : 'No topics in this roadmap.'}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {roadmaps.length === 0 && email && (
            <div className="tt-nudge">
              <span>{lang === 'ar'
                ? 'لا توجد رود ماب محفوظة بعد — أنشئ واحدة ثم اختبر مواضيعها، أو اكتب أي موضوع يدوياً.'
                : "No saved roadmap yet — create one to test its topics, or just type any topic below."}</span>
              <button className="tt-nudge-btn" onClick={() => navigate('/roadmap')}>
                {lang === 'ar' ? 'أنشئ رود ماب' : 'Create a roadmap'}
              </button>
            </div>
          )}
          {roadmaps.length === 0 && !email && (
            <p className="tt-no-roadmap">{t.noRoadmap}</p>
          )}

          {/* Selected topic confirmation */}
          {topic && (
            <div className="tt-selected">
              {lang === 'ar' ? 'سيتم إنشاء اختبار عن: ' : 'Quiz will be created on: '}
              <strong>{topic}</strong>
            </div>
          )}

          {/* Manual input */}
          <section className="tt-section">
            <label className="tt-label">{t.manualLabel}</label>
            <input
              className="tt-input"
              type="text"
              placeholder={t.manualPlaceholder}
              value={manualTopic}
              onChange={e => { setManualTopic(e.target.value); setSelectedTopic(''); }}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
          </section>

          {/* Count + language */}
          <section className="tt-section tt-options-row">
            <div className="tt-option-group">
              <label className="tt-label">{t.countLabel}</label>
              <div className="tt-count-toggle">
                {[5, 10].map(n => (
                  <button
                    key={n}
                    className={count === n ? 'active' : ''}
                    onClick={() => setCount(n)}
                  >{n}</button>
                ))}
              </div>
            </div>
          </section>

          {error && <p className="tt-error">{error}</p>}

          <button
            className="tt-btn-primary"
            onClick={handleGenerate}
            disabled={loading || !topic}
          >
            {loading ? t.generating : t.generateBtn}
          </button>
        </div>
      )}

      {/* ── Step: QUIZ ── */}
      {step === STEPS.QUIZ && questions.length > 0 && (
        <div className="tt-quiz">

          {/* Progress bar */}
          <div className="tt-progress-wrap">
            <div
              className="tt-progress-bar"
              style={{ width: `${((currentQ + 1) / total) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <div className="tt-question-card">
            <div className="tt-q-counter">
              {t.question} <strong>{currentQ + 1}</strong> {t.of} {total}
            </div>

            <p className="tt-question-text">{questions[currentQ].question}</p>

            <div className="tt-options">
              {Object.entries(questions[currentQ].options).map(([key, text]) => (
                <button
                  key={key}
                  className={`tt-option ${answers[currentQ] === key ? 'selected' : ''}`}
                  onClick={() => setAnswers(prev => ({ ...prev, [currentQ]: key }))}
                >
                  <span className="tt-option-key">{key}</span>
                  <span className="tt-option-text">{text}</span>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="tt-nav-row">
              <button
                className="tt-btn-ghost"
                onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                disabled={currentQ === 0}
              >{t.prevBtn}</button>

              <span className="tt-answered-count">
                {answered}/{total}
              </span>

              {currentQ < total - 1 ? (
                <button
                  className="tt-btn-secondary"
                  onClick={() => setCurrentQ(q => Math.min(total - 1, q + 1))}
                >{t.nextBtn}</button>
              ) : (
                <button
                  className="tt-btn-primary"
                  onClick={handleSubmit}
                  disabled={answered < total}
                >{t.submitBtn}</button>
              )}
            </div>

            {/* Question dots */}
            <div className="tt-dots">
              {questions.map((_, i) => (
                <button
                  key={i}
                  className={`tt-dot ${i === currentQ ? 'current' : ''} ${answers[i] !== undefined ? 'answered' : ''}`}
                  onClick={() => setCurrentQ(i)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step: RESULT ── */}
      {step === STEPS.RESULT && (
        <div className="tt-result">

          {/* Score ring */}
          <div className="tt-score-card">
            <div className="tt-score-ring">
              <svg viewBox="0 0 100 100">
                <circle className="tt-ring-bg" cx="50" cy="50" r="44" />
                <circle
                  className="tt-ring-fill"
                  cx="50" cy="50" r="44"
                  strokeDasharray={`${pct * 2.76} 276`}
                />
              </svg>
              <div className="tt-score-text">
                <span className="tt-score-pct">{pct}%</span>
                <span className="tt-score-fraction">{score}/{total}</span>
              </div>
            </div>

            <div className="tt-score-stats">
              <div className="tt-stat correct">✓ {t.correct}: {score}</div>
              <div className="tt-stat incorrect">✗ {t.incorrect}: {total - score - unanswered}</div>
              {unanswered > 0 && (
                <div className="tt-stat unanswered">― {t.unanswered}: {unanswered}</div>
              )}
            </div>
          </div>

          {/* Answer review */}
          <div className="tt-review">
            {questions.map((q, i) => {
              const userAns     = answers[i];
              const isCorrect   = userAns === q.answer;
              const isUnanswered = userAns === undefined;
              return (
                <div key={i} className={`tt-review-item ${isCorrect ? 'correct' : isUnanswered ? 'unanswered' : 'incorrect'}`}>
                  <div className="tt-review-q">
                    <span className="tt-review-num">{i + 1}</span>
                    <p>{q.question}</p>
                  </div>
                  <div className="tt-review-ans">
                    {isUnanswered ? (
                      <span className="tt-ans-badge unanswered">{t.notAnswered}</span>
                    ) : (
                      <>
                        <span className={`tt-ans-badge ${isCorrect ? 'correct' : 'wrong'}`}>
                          {t.yourAnswer}: {userAns} — {q.options[userAns]}
                        </span>
                        {!isCorrect && (
                          <span className="tt-ans-badge correct-ans">
                            {t.correctAnswer}: {q.answer} — {q.options[q.answer]}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save */}
          {saveState !== 'saved' && (
            <div className="tt-save-area">
              <label className="tt-label">{t.nameLabel}</label>
              <input
                className="tt-input"
                type="text"
                placeholder={t.namePlaceholder}
                value={testName}
                onChange={e => setTestName(e.target.value)}
              />
              <button
                className="tt-btn-primary"
                onClick={handleSave}
                disabled={saveState === 'saving' || !email}
              >
                {saveState === 'saving' ? t.saving : t.saveBtn}
              </button>
            </div>
          )}
          {saveState === 'saved' && (
            <p className="tt-saved-msg">✓ {t.saved}</p>
          )}

          <div className="tt-result-actions">
            <button className="tt-btn-secondary" onClick={() => { setStep(STEPS.QUIZ); setCurrentQ(0); setAnswers({}); setSaveState('idle'); }}>
              {t.retakeBtn}
            </button>
            <button className="tt-btn-ghost" onClick={handleReset}>
              {t.newTestBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
