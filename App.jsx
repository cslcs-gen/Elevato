import { useState, useRef, useEffect } from "react";

const RATING_SCALE = [
  { value: "A", label: "Outstanding", sub: "Exceed Beyond Expectations", color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
  { value: "B", label: "Exceed Expectations", sub: "Surpasses goals consistently", color: "#4F8EF7", bg: "rgba(79,142,247,0.12)" },
  { value: "C+", label: "Meet & Beyond Peers", sub: "Strong reliable contributor", color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  { value: "C", label: "Meet Expectations", sub: "Fulfills responsibilities", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  { value: "D", label: "Did Not Meet", sub: "Significant improvement needed", color: "#F87171", bg: "rgba(248,113,113,0.12)" },
];

const QUESTIONS = [
  { id: 1, category: "OKRs & Strategic Impact", text: "Describe a key objective the staff pursued this period. What measurable key results did they achieve, and how did those results contribute to team or company strategic goals?" },
  { id: 2, category: "KPI Achievement", text: "Which critical KPIs was this individual responsible for? To what extent were they met, exceeded, or missed — and what was the quantifiable impact of their performance on overall business outcomes?" },
  { id: 3, category: "STAR Method – Results", text: "Provide a STAR example: describe a Situation and Task, the Actions taken, and most importantly — what was the measurable Result? What value was created?" },
  { id: 4, category: "Innovation & Problem-Solving", text: "Did the individual identify and solve high-impact problems or introduce innovations that improved processes, reduced costs, or created new value? Describe the outcome." },
  { id: 5, category: "Collaboration & Leadership", text: "How did this individual influence, lead, or elevate the performance of those around them? What tangible team outcomes resulted from their leadership or collaboration?" },
];

const TABS = ["Assessment", "AI Review", "Writing Coach", "Development Plan"];

const callClaude = async (prompt, systemPrompt = "") => {
  const messages = [{ role: "user", content: prompt }];
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("\n") || "No response.";
};

const RatingButton = ({ value, label, sub, color, bg, selected, onClick }) => (
  <button
    onClick={() => onClick(value)}
    style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 14px", borderRadius: "10px", border: `1.5px solid ${selected ? color : "rgba(255,255,255,0.08)"}`,
      background: selected ? bg : "rgba(255,255,255,0.03)",
      cursor: "pointer", transition: "all 0.18s", width: "100%", textAlign: "left",
    }}
  >
    <span style={{
      width: 34, height: 34, borderRadius: "8px", background: selected ? color : "rgba(255,255,255,0.07)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "15px",
      color: selected ? "#0D1117" : color, flexShrink: 0, transition: "all 0.18s"
    }}>{value}</span>
    <span style={{ flex: 1 }}>
      <div style={{ fontSize: "13px", fontWeight: 600, color: selected ? color : "#E2E8F0" }}>{label}</div>
      <div style={{ fontSize: "11px", color: "rgba(226,232,240,0.5)", marginTop: 1 }}>{sub}</div>
    </span>
    {selected && <span style={{ fontSize: 16, color }}>✓</span>}
  </button>
);

const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#4F8EF7", fontSize: 13, padding: "12px 0" }}>
    <div style={{
      width: 18, height: 18, border: "2px solid rgba(79,142,247,0.3)",
      borderTopColor: "#4F8EF7", borderRadius: "50%",
      animation: "spin 0.7s linear infinite"
    }} />
    AI is analyzing...
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [staffText, setStaffText] = useState("");
  const [aiReview, setAiReview] = useState("");
  const [loadingReview, setLoadingReview] = useState(false);
  const [writingInput, setWritingInput] = useState("");
  const [coachChat, setCoachChat] = useState([]);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [coachMsg, setCoachMsg] = useState("");
  const [devPlan, setDevPlan] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachChat]);

  const handleRating = (qId, val) => setRatings(r => ({ ...r, [qId]: val }));
  const handleComment = (qId, val) => setComments(c => ({ ...c, [qId]: val }));

  const getRatingSummary = () =>
    QUESTIONS.map(q => `Q${q.id} [${q.category}]: Rating=${ratings[q.id] || "N/A"}, Comment="${comments[q.id] || "None"}"`).join("\n");

  const runAiReview = async () => {
    if (!staffText.trim()) return;
    setLoadingReview(true);
    setAiReview("");
    const sys = `You are an expert performance management AI. Analyze submitted staff materials against OKRs, KPIs, and STAR method frameworks. Focus on measurable impact. Use the rating scale: A (Outstanding), B (Exceed), C+ (Meet & Beyond Peers), C (Meet), D (Did Not Meet). Be constructive, professional, concise.`;
    const prompt = `Staff submitted materials:\n\n${staffText}\n\nAssessor questionnaire data:\n${getRatingSummary()}\n\nProvide: 1) Overall AI rating with justification, 2) Key strengths (with impact evidence), 3) Areas for improvement, 4) Comparison with assessor ratings where available. Format clearly with headers.`;
    const result = await callClaude(prompt, sys);
    setAiReview(result);
    setLoadingReview(false);
  };

  const sendCoachMessage = async () => {
    if (!coachMsg.trim() && coachChat.length === 0 && !writingInput.trim()) return;
    const userMsg = coachMsg.trim() || "Please review my writing and help me improve it.";
    const newChat = [...coachChat, { role: "user", text: userMsg }];
    setCoachChat(newChat);
    setCoachMsg("");
    setLoadingCoach(true);
    const sys = `You are a professional writing coach specializing in impact-based performance narratives. Help users articulate their achievements using the STAR method, focusing on measurable results. Ask leading questions to draw out quantifiable impact. Be encouraging, specific, and concise.`;
    const history = newChat.map(m => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`).join("\n");
    const context = writingInput ? `User's current draft:\n${writingInput}\n\n` : "";
    const result = await callClaude(`${context}Conversation:\n${history}`, sys);
    setCoachChat([...newChat, { role: "ai", text: result }]);
    setLoadingCoach(false);
  };

  const generatePlan = async () => {
    setLoadingPlan(true);
    setDevPlan("");
    const sys = `You are an expert in employee development. Generate personalized, actionable 6-month development plans using SMART goals. Be specific, forward-looking, and growth-oriented.`;
    const prompt = `Generate a 6-month personalized development plan based on:\n\nAssessor Ratings & Comments:\n${getRatingSummary()}\n\nAI Review:\n${aiReview || "Not yet generated"}\n\nStaff Materials:\n${staffText || "Not provided"}\n\nFormat: 1) Summary of performance, 2) Top 3 focus areas, 3) 3–5 SMART goals with milestones, 4) Recommended resources/actions, 5) Success metrics for next appraisal.`;
    const result = await callClaude(prompt, sys);
    setDevPlan(result);
    setLoadingPlan(false);
  };

  const completedQ = Object.keys(ratings).length;

  const tabContent = [
    // TAB 0: Assessment
    <div key="assess" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={styles.sectionHeader}>
        <span style={styles.badge}>ASSESSOR</span>
        <h2 style={styles.sectionTitle}>Performance Questionnaire</h2>
        <p style={styles.sectionSub}>{completedQ}/{QUESTIONS.length} questions rated</p>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {QUESTIONS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 3,
            background: ratings[i + 1] ? "#00C9A7" : "rgba(255,255,255,0.1)",
            transition: "background 0.3s"
          }} />
        ))}
      </div>
      {QUESTIONS.map(q => (
        <div key={q.id} style={styles.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ ...styles.badge, background: "rgba(79,142,247,0.15)", color: "#4F8EF7", fontSize: 10 }}>{q.category}</span>
          </div>
          <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 14px" }}>{q.text}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {RATING_SCALE.map(r => (
              <RatingButton key={r.value} {...r} selected={ratings[q.id] === r.value} onClick={v => handleRating(q.id, v)} />
            ))}
          </div>
          <textarea
            placeholder="Optional: Add specific observations or examples..."
            value={comments[q.id] || ""}
            onChange={e => handleComment(q.id, e.target.value)}
            style={styles.textarea}
            rows={2}
          />
        </div>
      ))}
    </div>,

    // TAB 1: AI Review
    <div key="ai" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={styles.sectionHeader}>
        <span style={styles.badge}>AI-POWERED</span>
        <h2 style={styles.sectionTitle}>Material Assessment</h2>
        <p style={styles.sectionSub}>Upload or paste staff achievements for AI analysis</p>
      </div>
      <div style={styles.card}>
        <label style={styles.label}>Staff Self-Assessment / Work Materials</label>
        <textarea
          value={staffText}
          onChange={e => setStaffText(e.target.value)}
          placeholder="Paste staff's self-assessment, project summaries, achievements, metrics, reports, or any relevant work materials here..."
          style={{ ...styles.textarea, minHeight: 140 }}
          rows={6}
        />
        <button onClick={runAiReview} disabled={!staffText.trim() || loadingReview} style={{
          ...styles.btn, marginTop: 12,
          opacity: (!staffText.trim() || loadingReview) ? 0.5 : 1
        }}>
          {loadingReview ? "Analyzing..." : "🤖 Run AI Assessment"}
        </button>
      </div>
      {loadingReview && <Spinner />}
      {aiReview && (
        <div style={{ ...styles.card, borderColor: "rgba(79,142,247,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4F8EF7", boxShadow: "0 0 8px #4F8EF7" }} />
            <span style={{ fontSize: 12, color: "#4F8EF7", fontWeight: 600, letterSpacing: "0.08em" }}>AI ASSESSMENT RESULT</span>
          </div>
          <pre style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{aiReview}</pre>
        </div>
      )}
    </div>,

    // TAB 2: Writing Coach
    <div key="coach" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={styles.sectionHeader}>
        <span style={styles.badge}>INTERACTIVE</span>
        <h2 style={styles.sectionTitle}>Writing Coach</h2>
        <p style={styles.sectionSub}>AI-guided improvement for impact-based narratives</p>
      </div>
      <div style={styles.card}>
        <label style={styles.label}>Your Draft (optional)</label>
        <textarea
          value={writingInput}
          onChange={e => setWritingInput(e.target.value)}
          placeholder="Paste a draft self-assessment or performance narrative to get coaching feedback..."
          style={{ ...styles.textarea, minHeight: 100 }}
          rows={4}
        />
      </div>
      <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C9A7", boxShadow: "0 0 8px #00C9A7" }} />
          <span style={{ fontSize: 12, color: "#00C9A7", fontWeight: 600, letterSpacing: "0.08em" }}>COACHING SESSION</span>
        </div>
        <div style={{ minHeight: 180, maxHeight: 320, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {coachChat.length === 0 && (
            <p style={{ fontSize: 13, color: "rgba(226,232,240,0.35)", textAlign: "center", margin: "30px 0" }}>
              Start a conversation to get writing guidance.<br />Ask for feedback, improvement tips, or STAR method help.
            </p>
          )}
          {coachChat.map((m, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start"
            }}>
              <div style={{
                maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.role === "user" ? "rgba(79,142,247,0.2)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${m.role === "user" ? "rgba(79,142,247,0.3)" : "rgba(255,255,255,0.08)"}`,
                fontSize: 13, color: "#E2E8F0", lineHeight: 1.6,
                whiteSpace: "pre-wrap"
              }}>{m.text}</div>
            </div>
          ))}
          {loadingCoach && <Spinner />}
          <div ref={chatEndRef} />
        </div>
        <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
          <input
            value={coachMsg}
            onChange={e => setCoachMsg(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCoachMessage(); } }}
            placeholder="Ask for feedback or help improving your narrative..."
            style={{ ...styles.input, flex: 1 }}
          />
          <button onClick={sendCoachMessage} disabled={loadingCoach} style={{
            ...styles.btn, padding: "10px 16px", flexShrink: 0,
            opacity: loadingCoach ? 0.5 : 1
          }}>Send</button>
        </div>
      </div>
    </div>,

    // TAB 3: Development Plan
    <div key="plan" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={styles.sectionHeader}>
        <span style={styles.badge}>FORWARD-LOOKING</span>
        <h2 style={styles.sectionTitle}>Development Plan</h2>
        <p style={styles.sectionSub}>AI-generated SMART goals for next 6 months</p>
      </div>
      <div style={styles.card}>
        <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6, margin: "0 0 14px" }}>
          Generate a personalized development plan synthesizing all assessor ratings, AI review findings, and staff materials into actionable SMART goals.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {[
            { label: "Ratings", val: `${completedQ}/${QUESTIONS.length}`, ok: completedQ > 0 },
            { label: "AI Review", val: aiReview ? "Done" : "Pending", ok: !!aiReview },
            { label: "Materials", val: staffText ? "Provided" : "None", ok: !!staffText },
          ].map(s => (
            <div key={s.label} style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: s.ok ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
              color: s.ok ? "#00C9A7" : "#64748B",
              border: `1px solid ${s.ok ? "rgba(0,201,167,0.25)" : "rgba(255,255,255,0.06)"}`
            }}>{s.label}: {s.val}</div>
          ))}
        </div>
        <button onClick={generatePlan} disabled={loadingPlan} style={{
          ...styles.btn, width: "100%", opacity: loadingPlan ? 0.5 : 1
        }}>
          {loadingPlan ? "Generating Plan..." : "✨ Generate Development Plan"}
        </button>
      </div>
      {loadingPlan && <Spinner />}
      {devPlan && (
        <div style={{ ...styles.card, borderColor: "rgba(0,201,167,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C9A7", boxShadow: "0 0 8px #00C9A7" }} />
            <span style={{ fontSize: 12, color: "#00C9A7", fontWeight: 600, letterSpacing: "0.08em" }}>6-MONTH DEVELOPMENT PLAN</span>
          </div>
          <pre style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{devPlan}</pre>
        </div>
      )}
    </div>,
  ];

  return (
    <div style={styles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        textarea, input { outline: none; resize: none; }
        textarea:focus, input:focus { border-color: rgba(79,142,247,0.5) !important; }
        button:active { transform: scale(0.97); }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={styles.logo}>EL</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#F1F5F9" }}>Elevate</div>
            <div style={{ fontSize: 11, color: "#4F8EF7", letterSpacing: "0.1em", fontWeight: 500 }}>PERFORMANCE SUITE</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#64748B" }}>Q2 · 2026</div>
      </div>

      {/* Staff Card */}
      <div style={styles.staffCard}>
        <div style={styles.avatar}>JD</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#F1F5F9" }}>Jane Doe</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Senior Product Manager · Engineering</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2 }}>OVERALL</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: completedQ > 0 ? "#00C9A7" : "#334155" }}>
            {completedQ > 0 ? (Object.values(ratings).every(r => r === "A") ? "A" : Object.values(ratings).some(r => r === "A") ? "B+" : "C+") : "—"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            flex: 1, padding: "8px 4px", background: "none", border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
            color: activeTab === i ? "#4F8EF7" : "#475569",
            borderBottom: `2px solid ${activeTab === i ? "#4F8EF7" : "transparent"}`,
            transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif"
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 16px 100px", animation: "fadeUp 0.3s ease" }}>
        {tabContent[activeTab]}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0D1117",
    fontFamily: "'DM Sans', sans-serif",
    color: "#E2E8F0",
    maxWidth: 480,
    margin: "0 auto",
    position: "relative",
  },
  header: {
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    position: "sticky",
    top: 0,
    background: "rgba(13,17,23,0.95)",
    backdropFilter: "blur(12px)",
    zIndex: 10,
  },
  logo: {
    width: 36, height: 36, borderRadius: 10,
    background: "linear-gradient(135deg, #4F8EF7, #00C9A7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700, color: "#0D1117",
  },
  staffCard: {
    margin: 16,
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 12,
    background: "linear-gradient(135deg, rgba(79,142,247,0.3), rgba(0,201,167,0.3))",
    border: "1.5px solid rgba(79,142,247,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, color: "#4F8EF7",
    flexShrink: 0,
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    position: "sticky",
    top: 69,
    background: "rgba(13,17,23,0.95)",
    backdropFilter: "blur(12px)",
    zIndex: 9,
    padding: "0 4px",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "16px",
  },
  sectionHeader: {
    marginBottom: 4,
  },
  badge: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    background: "rgba(255,255,255,0.07)",
    color: "#64748B",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "'Playfair Display', serif",
    color: "#F1F5F9",
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 0,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  textarea: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s",
  },
  input: {
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#E2E8F0",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s",
  },
  btn: {
    background: "linear-gradient(135deg, #4F8EF7, #3B6FD4)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "opacity 0.2s, transform 0.1s",
    letterSpacing: "0.02em",
  },
};
