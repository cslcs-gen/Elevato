import { useState, useRef, useEffect } from "react";

const TABS = ["Assessment", "AI Review", "Writing Coach", "Development Plan"];

const callClaude = async (prompt, systemPrompt = "", maxTokens = 1500, timeoutMs = 45000) => {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.map(b => b.text || "").join("\n") || "No response.";
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("TIMEOUT");
    throw e;
  }
};

const RATING_COLORS = {
  A: { color: "#00C9A7", bg: "rgba(0,201,167,0.15)", label: "Outstanding", sub: "Exceeds Beyond Expectations" },
  B: { color: "#4F8EF7", bg: "rgba(79,142,247,0.15)", label: "Exceed Expectations", sub: "Surpasses goals consistently" },
  "C+": { color: "#A78BFA", bg: "rgba(167,139,250,0.15)", label: "Meet & Beyond Peers", sub: "Strong reliable contributor" },
  C: { color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: "Meet Expectations", sub: "Fulfills responsibilities" },
  D: { color: "#F87171", bg: "rgba(248,113,113,0.15)", label: "Did Not Meet", sub: "Significant improvement needed" },
};

const Spinner = ({ text = "AI is thinking...", seconds = 0 }) => (
  <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.2)", marginTop: 4 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#4F8EF7", fontSize: 13 }}>
      <div style={{ width: 18, height: 18, border: "2px solid rgba(79,142,247,0.3)", borderTopColor: "#4F8EF7", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
      <span>{text}</span>
      {seconds > 0 && <span style={{ marginLeft: "auto", fontSize: 12, color: "#334155", fontVariantNumeric: "tabular-nums" }}>{seconds}s</span>}
    </div>
    {seconds > 15 && (
      <p style={{ fontSize: 11, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>
        ⏳ This is normal — complex AI requests can take 20–40s. Please wait...
      </p>
    )}
    {seconds > 35 && (
      <p style={{ fontSize: 11, color: "#F87171", marginTop: 4, lineHeight: 1.5 }}>
        ⚠️ Taking longer than usual. If it doesn't complete, tap Retry.
      </p>
    )}
  </div>
);

const RatingBadge = ({ rating }) => {
  if (!rating || !RATING_COLORS[rating]) return null;
  const r = RATING_COLORS[rating];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: r.bg, border: `1.5px solid ${r.color}40`, marginTop: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 16, color: "#0D1117", flexShrink: 0 }}>{rating}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.label}</div>
        <div style={{ fontSize: 11, color: "rgba(226,232,240,0.5)", marginTop: 1 }}>{r.sub}</div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  // Assessment state
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffDept, setStaffDept] = useState("");
  const [appraisalPeriod, setAppraisalPeriod] = useState("Q2 2026");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [qTimer, setQTimer] = useState(0);
  const [assessTimer, setAssessTimer] = useState(0);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [qError, setQError] = useState("");
  const [assessError, setAssessError] = useState("");
  const [step, setStep] = useState("setup");

  // AI Review
  const [staffText, setStaffText] = useState("");
  const [aiReview, setAiReview] = useState("");
  const [loadingReview, setLoadingReview] = useState(false);

  // Writing Coach
  const [writingInput, setWritingInput] = useState("");
  const [coachChat, setCoachChat] = useState([]);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [coachMsg, setCoachMsg] = useState("");
  const chatEndRef = useRef(null);

  // Dev Plan
  const [devPlan, setDevPlan] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [coachChat]);

  const generateQuestions = async () => {
    if (!staffRole.trim()) return;
    setLoadingQuestions(true);
    setQError("");
    setQuestions([]);
    setAnswers({});
    setAssessmentResult(null);
    setQTimer(0);

    const interval = setInterval(() => setQTimer(t => t + 1), 1000);

    const sys = `You are an expert HR performance management specialist. Generate structured appraisal questionnaires grounded in industry frameworks. Always cite the specific framework each question is based on. Be precise and professional.`;
    const prompt = `Generate exactly 5 performance appraisal questions for:
- Name: ${staffName || "Staff Member"}
- Role: ${staffRole}
- Department: ${staffDept || "General"}
- Period: ${appraisalPeriod}

Requirements:
1. Questions must be open-ended for the ASSESSOR/MANAGER to answer based on their observations of the staff
2. Cover these 5 areas: Strategic Impact, KPI Achievement, Innovation, Leadership, Professional Growth
3. Each question MUST cite an industry reference from: OKRs (Doerr 2018), KPI Institute, STAR Method, SHRM Competency Model, Balanced Scorecard (Kaplan & Norton 1992)

Respond ONLY in this exact JSON (no extra text, no markdown fences):
[{"id":1,"category":"Category","question":"Full assessor question","framework":"Framework Name","reference":"Author/Source, Year","hint":"What a strong answer looks like"}]`;

    try {
      const raw = await callClaude(prompt, sys, 1200, 40000);
      clearInterval(interval);
      const clean = raw.replace(/```json|```/g, "").trim();
      setQuestions(JSON.parse(clean));
      setStep("questions");
    } catch(e) {
      clearInterval(interval);
      if (e.message === "TIMEOUT") {
        setQError("Request timed out. Tap 'Retry' to try again.");
      } else {
        setQError("Something went wrong: " + e.message + ". Tap Retry.");
      }
    }
    setLoadingQuestions(false);
    setQTimer(0);
  };

  const submitAssessment = async () => {
    const answered = Object.values(answers).filter(a => a?.trim()).length;
    if (answered < 3) return;
    setLoadingAssessment(true);
    setAssessError("");
    setAssessmentResult(null);
    setAssessTimer(0);

    const interval = setInterval(() => setAssessTimer(t => t + 1), 1000);

    const sys = `You are a senior HR performance assessment AI. Analyse assessor responses and determine an objective, evidence-based performance rating. Be fair, specific and constructive.`;
    const qa = questions.map(q => `CATEGORY: ${q.category} [${q.framework}]\nQ: ${q.question}\nA: ${answers[q.id] || "(Not answered)"}`).join("\n---\n");
    const prompt = `Assess ${staffName || "staff"} (${staffRole}) for ${appraisalPeriod}.\n\n${qa}\n\nRespond ONLY with JSON (no markdown):\n{"overallRating":"A|B|C+|C|D","overallRationale":"2 sentences with evidence","categoryRatings":[{"category":"name","rating":"A|B|C+|C|D","evidence":"evidence"}],"strengths":["strength"],"improvements":["area"],"summary":"2 sentence narrative"}\n\nA=Outstanding, B=Exceed Expectations, C+=Meet & Beyond Peers, C=Meet Expectations, D=Did Not Meet`;

    try {
      const raw = await callClaude(prompt, sys, 1200, 40000);
      clearInterval(interval);
      const clean = raw.replace(/```json|```/g, "").trim();
      setAssessmentResult(JSON.parse(clean));
      setStep("result");
    } catch(e) {
      clearInterval(interval);
      if (e.message === "TIMEOUT") {
        setAssessError("Request timed out. Tap Retry to try again.");
      } else {
        setAssessError("Something went wrong. Tap Retry.");
      }
    }
    setLoadingAssessment(false);
    setAssessTimer(0);
  };

  const runAiReview = async () => {
    if (!staffText.trim()) return;
    setLoadingReview(true);
    setAiReview("");
    const context = assessmentResult ? `\nAssessor rating: ${assessmentResult.overallRating} — ${assessmentResult.overallRationale}` : "";
    const result = await callClaude(
      `Staff materials:\n${staffText}${context}\n\nProvide: 1) AI rating with justification, 2) Key strengths with impact evidence, 3) Areas for improvement, 4) Alignment with assessor rating. Use headers.`,
      `You are an expert performance management AI. Analyse materials against OKRs, KPIs, and STAR frameworks. Use rating scale: A/B/C+/C/D. Be constructive and concise.`
    );
    setAiReview(result);
    setLoadingReview(false);
  };

  const sendCoachMessage = async () => {
    if (!coachMsg.trim() && coachChat.length === 0) return;
    const userMsg = coachMsg.trim() || "Please review my writing.";
    const newChat = [...coachChat, { role: "user", text: userMsg }];
    setCoachChat(newChat);
    setCoachMsg("");
    setLoadingCoach(true);
    const history = newChat.map(m => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`).join("\n");
    const result = await callClaude(
      `${writingInput ? "Draft:\n" + writingInput + "\n\n" : ""}${history}`,
      `You are a writing coach for impact-based performance narratives. Help articulate achievements using STAR method. Ask leading questions. Be encouraging and concise.`
    );
    setCoachChat([...newChat, { role: "ai", text: result }]);
    setLoadingCoach(false);
  };

  const generatePlan = async () => {
    setLoadingPlan(true);
    setDevPlan("");
    const ratingCtx = assessmentResult ? `Rating: ${assessmentResult.overallRating}\nStrengths: ${assessmentResult.strengths?.join(", ")}\nImprovements: ${assessmentResult.improvements?.join(", ")}` : "No assessment yet";
    const result = await callClaude(
      `6-month development plan for ${staffName || "staff"} (${staffRole}):\n\nAssessment:\n${ratingCtx}\n\nAI Review:\n${aiReview || "Not done"}\n\nFormat: 1) Summary, 2) Top 3 focus areas, 3) 3-5 SMART goals with milestones, 4) Recommended actions, 5) Success metrics.`,
      `You are an employee development expert. Generate personalised, actionable plans using SMART goals. Be specific and growth-oriented.`
    );
    setDevPlan(result);
    setLoadingPlan(false);
  };

  const answeredCount = Object.values(answers).filter(a => a?.trim()).length;
  const overallRating = assessmentResult?.overallRating;

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
        textarea,input{outline:none}textarea{resize:none}
        textarea:focus,input:focus{border-color:rgba(79,142,247,0.5)!important}
        button:active{transform:scale(0.97)}
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={S.logo}>EL</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: "#F1F5F9" }}>Elevate</div>
            <div style={{ fontSize: 11, color: "#4F8EF7", letterSpacing: "0.1em", fontWeight: 500 }}>PERFORMANCE SUITE</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#64748B" }}>{appraisalPeriod}</div>
      </div>

      {/* Staff Card */}
      <div style={S.staffCard}>
        <div style={S.avatar}>{staffName ? staffName.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() : "—"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#F1F5F9" }}>{staffName || "No staff selected"}</div>
          <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{staffRole || "Enter staff details to begin"}{staffDept ? ` · ${staffDept}` : ""}</div>
        </div>
        {overallRating && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2 }}>RATING</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: RATING_COLORS[overallRating]?.color }}>{overallRating}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: "8px 2px", background: "none", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", color: activeTab === i ? "#4F8EF7" : "#475569", borderBottom: `2px solid ${activeTab === i ? "#4F8EF7" : "transparent"}`, transition: "all 0.2s", fontFamily: "'DM Sans',sans-serif" }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 16px 100px", animation: "fadeUp 0.3s ease" }}>

        {/* ── ASSESSMENT TAB ── */}
        {activeTab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={S.badge}>STEP {step === "setup" ? "1" : step === "questions" ? "2" : "3"} OF 3</span>
              <h2 style={S.title}>{step === "setup" ? "Staff Details" : step === "questions" ? "Questionnaire" : "AI Rating"}</h2>
              <p style={S.sub}>{step === "setup" ? "Enter staff info — AI will generate tailored, industry-referenced questions" : step === "questions" ? `Describe your observations about ${staffName || "the staff"} — AI determines the rating` : "AI-determined rating based on your responses"}</p>
            </div>

            {step === "setup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[["STAFF NAME", staffName, setStaffName, "e.g. Jane Doe", false],
                  ["JOB ROLE / TITLE *", staffRole, setStaffRole, "e.g. Senior Product Manager", false],
                  ["DEPARTMENT", staffDept, setStaffDept, "e.g. Engineering, Sales, HR", false],
                  ["APPRAISAL PERIOD", appraisalPeriod, setAppraisalPeriod, "e.g. Q2 2026", false]
                ].map(([label, val, setter, ph]) => (
                  <div key={label} style={S.card}>
                    <label style={S.label}>{label}</label>
                    <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={{ ...S.input, width: "100%" }} />
                  </div>
                ))}
                <button onClick={generateQuestions} disabled={!staffRole.trim() || loadingQuestions} style={{ ...S.btn, width: "100%", padding: 14, fontSize: 14, opacity: (!staffRole.trim() || loadingQuestions) ? 0.5 : 1 }}>
                  {loadingQuestions ? "Generating Questions..." : "✨ Generate AI Questions"}
                </button>
                {loadingQuestions && <Spinner text="Generating questions..." seconds={qTimer} />}
                {qError && (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", fontSize: 13, color: "#F87171" }}>
                    ⚠️ {qError}
                    <button onClick={generateQuestions} style={{ display: "block", marginTop: 10, background: "rgba(248,113,113,0.2)", border: "1px solid rgba(248,113,113,0.4)", color: "#F87171", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%" }}>↺ Retry</button>
                  </div>
                )}
              </div>
            )}

            {step === "questions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {questions.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: answers[i+1]?.trim() ? "#00C9A7" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />)}
                </div>
                <p style={{ fontSize: 12, color: "#64748B", textAlign: "right" }}>{answeredCount}/{questions.length} answered · min 4 required</p>

                {questions.map((q, idx) => (
                  <div key={q.id} style={S.card}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      <span style={{ ...S.badge, background: "rgba(79,142,247,0.15)", color: "#4F8EF7", fontSize: 10, marginBottom: 0 }}>{q.category}</span>
                      <span style={{ ...S.badge, background: "rgba(0,201,167,0.1)", color: "#00C9A7", fontSize: 10, marginBottom: 0 }}>{q.framework}</span>
                    </div>
                    <p style={{ fontSize: 14, color: "#E2E8F0", lineHeight: 1.65, margin: "0 0 8px", fontWeight: 500 }}>Q{idx+1}. {q.question}</p>
                    {/* Industry Reference */}
                    <div style={{ display: "flex", gap: 6, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: "#4F8EF7", flexShrink: 0 }}>📎</span>
                      <span style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}><span style={{ color: "#64748B", fontWeight: 600 }}>Ref: </span>{q.reference}</span>
                    </div>
                    {q.hint && <p style={{ fontSize: 11, color: "#475569", fontStyle: "italic", margin: "0 0 10px", lineHeight: 1.5 }}>💡 {q.hint}</p>}
                    <textarea value={answers[q.id] || ""} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Describe what you observed about this staff member..." style={{ ...S.textarea, minHeight: 90 }} rows={4} />
                  </div>
                ))}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep("setup")} style={{ ...S.btnSec, flex: 1 }}>← Back</button>
                  <button onClick={submitAssessment} disabled={answeredCount < 3 || loadingAssessment} style={{ ...S.btn, flex: 2, opacity: (answeredCount < 3 || loadingAssessment) ? 0.5 : 1 }}>
                    {loadingAssessment ? "Assessing..." : "🤖 Get AI Rating"}
                  </button>
                </div>
                {loadingAssessment && <Spinner text="Analysing responses..." seconds={assessTimer} />}
                {assessError && (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", fontSize: 13, color: "#F87171" }}>
                    ⚠️ {assessError}
                    <button onClick={submitAssessment} style={{ display: "block", marginTop: 10, background: "rgba(248,113,113,0.2)", border: "1px solid rgba(248,113,113,0.4)", color: "#F87171", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%" }}>↺ Retry</button>
                  </div>
                )}
              </div>
            )}

            {step === "result" && assessmentResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Overall Rating */}
                <div style={{ ...S.card, borderColor: `${RATING_COLORS[assessmentResult.overallRating]?.color}40` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: RATING_COLORS[assessmentResult.overallRating]?.color, boxShadow: `0 0 8px ${RATING_COLORS[assessmentResult.overallRating]?.color}` }} />
                    <span style={{ fontSize: 11, color: RATING_COLORS[assessmentResult.overallRating]?.color, fontWeight: 700, letterSpacing: "0.08em" }}>AI OVERALL RATING</span>
                  </div>
                  <RatingBadge rating={assessmentResult.overallRating} />
                  <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6, marginTop: 12 }}>{assessmentResult.overallRationale}</p>
                </div>

                {assessmentResult.summary && (
                  <div style={S.card}>
                    <label style={S.label}>PERFORMANCE NARRATIVE</label>
                    <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.7, marginTop: 8 }}>{assessmentResult.summary}</p>
                  </div>
                )}

                {assessmentResult.categoryRatings?.length > 0 && (
                  <div style={S.card}>
                    <label style={S.label}>CATEGORY BREAKDOWN</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                      {assessmentResult.categoryRatings.map((cr, i) => {
                        const rc = RATING_COLORS[cr.rating] || RATING_COLORS["C"];
                        return (
                          <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: rc.bg, border: `1px solid ${rc.color}30` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{cr.category}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: rc.color, fontFamily: "'Playfair Display',serif" }}>{cr.rating}</span>
                            </div>
                            <p style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5, margin: 0 }}>{cr.evidence}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {assessmentResult.strengths?.length > 0 && (
                  <div style={S.card}>
                    <label style={S.label}>KEY STRENGTHS</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      {assessmentResult.strengths.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: 8 }}>
                          <span style={{ color: "#00C9A7", flexShrink: 0 }}>✓</span>
                          <span style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.5 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assessmentResult.improvements?.length > 0 && (
                  <div style={S.card}>
                    <label style={S.label}>AREAS FOR IMPROVEMENT</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      {assessmentResult.improvements.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: 8 }}>
                          <span style={{ color: "#F59E0B", flexShrink: 0 }}>→</span>
                          <span style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.5 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep("questions")} style={{ ...S.btnSec, flex: 1 }}>← Revise</button>
                  <button onClick={() => { setStep("setup"); setQuestions([]); setAnswers({}); setAssessmentResult(null); }} style={{ ...S.btnSec, flex: 1 }}>New ↺</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI REVIEW TAB ── */}
        {activeTab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={S.badge}>AI-POWERED</span>
              <h2 style={S.title}>Material Assessment</h2>
              <p style={S.sub}>Paste staff's self-assessment or work materials for independent AI review</p>
            </div>
            <div style={S.card}>
              <label style={S.label}>STAFF MATERIALS / SELF-ASSESSMENT</label>
              <textarea value={staffText} onChange={e => setStaffText(e.target.value)} placeholder="Paste staff's self-assessment, project summaries, achievements, metrics..." style={{ ...S.textarea, minHeight: 140 }} rows={6} />
              <button onClick={runAiReview} disabled={!staffText.trim() || loadingReview} style={{ ...S.btn, marginTop: 12, width: "100%", opacity: (!staffText.trim() || loadingReview) ? 0.5 : 1 }}>
                {loadingReview ? "Analysing..." : "🤖 Run AI Material Review"}
              </button>
            </div>
            {loadingReview && <Spinner text="Reviewing against OKRs, KPIs & STAR frameworks..." />}
            {aiReview && (
              <div style={{ ...S.card, borderColor: "rgba(79,142,247,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4F8EF7", boxShadow: "0 0 8px #4F8EF7" }} />
                  <span style={{ fontSize: 11, color: "#4F8EF7", fontWeight: 700, letterSpacing: "0.08em" }}>AI MATERIAL ASSESSMENT</span>
                </div>
                <pre style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{aiReview}</pre>
              </div>
            )}
          </div>
        )}

        {/* ── WRITING COACH TAB ── */}
        {activeTab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={S.badge}>INTERACTIVE</span>
              <h2 style={S.title}>Writing Coach</h2>
              <p style={S.sub}>AI-guided improvement for impact-based narratives</p>
            </div>
            <div style={S.card}>
              <label style={S.label}>DRAFT TO IMPROVE (OPTIONAL)</label>
              <textarea value={writingInput} onChange={e => setWritingInput(e.target.value)} placeholder="Paste a self-assessment draft to get coaching..." style={{ ...S.textarea, minHeight: 90 }} rows={4} />
            </div>
            <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C9A7", boxShadow: "0 0 8px #00C9A7" }} />
                <span style={{ fontSize: 11, color: "#00C9A7", fontWeight: 700, letterSpacing: "0.08em" }}>COACHING SESSION</span>
              </div>
              <div style={{ minHeight: 180, maxHeight: 300, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {coachChat.length === 0 && <p style={{ fontSize: 13, color: "rgba(226,232,240,0.3)", textAlign: "center", margin: "30px 0" }}>Start a conversation to get writing guidance.</p>}
                {coachChat.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "rgba(79,142,247,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${m.role === "user" ? "rgba(79,142,247,0.3)" : "rgba(255,255,255,0.08)"}`, fontSize: 13, color: "#E2E8F0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.text}</div>
                  </div>
                ))}
                {loadingCoach && <Spinner />}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
                <input value={coachMsg} onChange={e => setCoachMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendCoachMessage(); } }} placeholder="Ask for feedback or tips..." style={{ ...S.input, flex: 1 }} />
                <button onClick={sendCoachMessage} disabled={loadingCoach} style={{ ...S.btn, padding: "10px 16px", flexShrink: 0, opacity: loadingCoach ? 0.5 : 1 }}>Send</button>
              </div>
            </div>
          </div>
        )}

        {/* ── DEVELOPMENT PLAN TAB ── */}
        {activeTab === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={S.badge}>FORWARD-LOOKING</span>
              <h2 style={S.title}>Development Plan</h2>
              <p style={S.sub}>AI-generated SMART goals for next 6 months</p>
            </div>
            <div style={S.card}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {[{ label: "Assessment", ok: !!assessmentResult }, { label: "AI Review", ok: !!aiReview }, { label: "Materials", ok: !!staffText }].map(s => (
                  <div key={s.label} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.ok ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)", color: s.ok ? "#00C9A7" : "#64748B", border: `1px solid ${s.ok ? "rgba(0,201,167,0.25)" : "rgba(255,255,255,0.06)"}` }}>{s.ok ? "✓" : "○"} {s.label}</div>
                ))}
              </div>
              <button onClick={generatePlan} disabled={loadingPlan} style={{ ...S.btn, width: "100%", opacity: loadingPlan ? 0.5 : 1 }}>
                {loadingPlan ? "Generating..." : "✨ Generate Development Plan"}
              </button>
            </div>
            {loadingPlan && <Spinner text="Crafting a personalised SMART development plan..." />}
            {devPlan && (
              <div style={{ ...S.card, borderColor: "rgba(0,201,167,0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C9A7", boxShadow: "0 0 8px #00C9A7" }} />
                  <span style={{ fontSize: 11, color: "#00C9A7", fontWeight: 700, letterSpacing: "0.08em" }}>6-MONTH DEVELOPMENT PLAN</span>
                </div>
                <pre style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{devPlan}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0D1117", fontFamily: "'DM Sans',sans-serif", color: "#E2E8F0", maxWidth: 480, margin: "0 auto" },
  header: { padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "rgba(13,17,23,0.95)", backdropFilter: "blur(12px)", zIndex: 10 },
  logo: { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #4F8EF7, #00C9A7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#0D1117" },
  staffCard: { margin: 16, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, rgba(79,142,247,0.3), rgba(0,201,167,0.3))", border: "1.5px solid rgba(79,142,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#4F8EF7", flexShrink: 0 },
  tabBar: { display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 69, background: "rgba(13,17,23,0.95)", backdropFilter: "blur(12px)", zIndex: 9, padding: "0 4px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px" },
  badge: { display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(255,255,255,0.07)", color: "#64748B", marginBottom: 6 },
  title: { fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: "#F1F5F9", marginBottom: 4 },
  sub: { fontSize: 13, color: "#64748B" },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.08em", marginBottom: 8 },
  textarea: { width: "100%", background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", color: "#E2E8F0", fontSize: 13, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.2s" },
  input: { background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", color: "#E2E8F0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.2s" },
  btn: { background: "linear-gradient(135deg, #4F8EF7, #3B6FD4)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "opacity 0.2s, transform 0.1s", letterSpacing: "0.02em" },
  btnSec: { background: "rgba(255,255,255,0.06)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" },
};
