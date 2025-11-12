import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Bell, Calendar, Clock, Check, X, Upload } from "lucide-react";

/**
 * CAS Department – TA Application Portal (Frontend Only, Preview)
 * - Student sees status ONLY in My Account (not on Postings)
 * - Resume & Transcript uploads are OPTIONAL (PDF if provided)
 * - Multiple professor accounts (one course per account) with switcher
 * - Reset Portal button clears localStorage and reloads
 * - Balanced JSX; no duplicate component identifiers
 * - Lightweight runtime tests via console.assert (do not break UI)
 */

// ---------------- Branding ----------------
const PRIMARY = "#7A003C";
const BG = "#F9FAFB";

// ---------------- Mock Data ----------------
const INITIAL_POSTINGS = [
  {
    id: "SFWRENG-2HC3-W25",
    code: "2HC3",
    title: "SFWRENG 2HC3 – Human-Computer Interfaces",
    professor: "Dr. Yuan",
    studentPrevGrade: "A",
    classTime: "Mon 14:30–16:20 (ITB 137)",
    tutorialSlots: [
      { day: "Tue", start: "10:30", end: "11:20" },
      { day: "Thu", start: "09:30", end: "10:20" },
    ],
  },
  {
    id: "SFWRENG-2AA4-W25",
    code: "2AA4",
    title: "SFWRENG 2AA4 – Software Abstraction & Specification",
    professor: "Dr. Smith",
    studentPrevGrade: "A-",
    classTime: "Tue 10:30–12:20 (ITB 201)",
    tutorialSlots: [
      { day: "Wed", start: "15:30", end: "16:20" },
      { day: "Fri", start: "11:30", end: "12:20" },
    ],
  },
];

// Example student timetable (could be fed by Mosaic later)
const STUDENT_CLASSES = [
  { day: "Mon", start: "12:30", end: "13:20" },
  { day: "Tue", start: "09:30", end: "10:20" },
  { day: "Wed", start: "14:30", end: "15:20" },
  { day: "Thu", start: "13:30", end: "14:20" },
];

// ---------------- Storage Helpers ----------------
const storage = {
  get(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  }
};

// ---------------- Utility & Tests ----------------
function isPdf(file) {
  if (!file) return false;
  const okMime = file.type === "application/pdf";
  const okExt = file.name?.toLowerCase().endsWith(".pdf");
  return okMime || okExt;
}

/**
 * Optional upload validation:
 * - If provided, must be PDF; if omitted, still valid.
 */
function validateOptionalUploads(payload) {
  if (!payload) return true;
  const { resume, transcript } = payload;
  if (resume && !isPdf(resume)) return false;
  if (transcript && !isPdf(transcript)) return false;
  return true;
}

// Inline non-breaking tests
(function runInlineTests(){
  console.assert(isPdf({ name: "a.pdf", type: "application/pdf" }) === true, "isPdf: accept proper PDF");
  console.assert(isPdf({ name: "a.PDF", type: "" }) === true, "isPdf: accept .PDF ext");
  console.assert(isPdf({ name: "a.txt", type: "text/plain" }) === false, "isPdf: reject non-PDF");
  console.assert(validateOptionalUploads(null) === true, "optional: null payload ok");
  console.assert(validateOptionalUploads({}) === true, "optional: both missing ok");
  console.assert(validateOptionalUploads({ resume: { name: "r.pdf", type: "application/pdf" } }) === true, "optional: single valid ok");
  console.assert(validateOptionalUploads({ transcript: { name: "t.txt", type: "text/plain" } }) === false, "optional: non-PDF should fail");
})();

// ---------------- App ----------------
export default function App(){
  // top-level tabs
  const [tab, setTab] = useState("student"); // "student" | "professor"
  const [studentSubTab, setStudentSubTab] = useState("postings"); // "postings" | "account"

  // data
  const [postings] = useState(INITIAL_POSTINGS);

  // professor account selection (one course per prof account)
  const [profPostingId, setProfPostingId] = useState(() => storage.get("profPostingId", INITIAL_POSTINGS[0]?.id || ""));
  useEffect(() => storage.set("profPostingId", profPostingId), [profPostingId]);

  // applications
  const [applications, setApplications] = useState(() => storage.get("apps", []));
  useEffect(() => storage.set("apps", applications), [applications]);

  // toasts
  const [toasts, setToasts] = useState([]);
  const notify = (title, body) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(t => [...t, { id, title, body }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <Header
        tab={tab}
        setTab={setTab}
        studentSubTab={studentSubTab}
        setStudentSubTab={setStudentSubTab}
      />

      <main className="w-full px-8 py-6">
        {tab === "student" ? (
          studentSubTab === "postings" ? (
            <StudentBrowse
              postings={postings}
              onSubmitted={(courseCode)=>notify("Application Submitted", `${courseCode} submitted`)}
              setApplications={setApplications}
            />
          ) : (
            <StudentAccount applications={applications} />
          )
        ) : (
          <ProfessorView
            postings={postings}
            applications={applications}
            setApplications={setApplications}
            pingStudent={(msg) => notify("Application Updated", msg)}
            profPostingId={profPostingId}
            setProfPostingId={setProfPostingId}
          />
        )}
      </main>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-white shadow-lg border px-4 py-3 rounded-xl w-80"
            style={{ borderColor: PRIMARY }}
          >
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 mt-0.5" color={PRIMARY} />
              <div>
                <div className="font-medium" style={{ color: PRIMARY }}>{t.title}</div>
                <div className="text-sm text-gray-600">{t.body}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Header ----------------
function Header({ tab = "student", setTab = () => {}, studentSubTab = "postings", setStudentSubTab = () => {} }){
  return (
    <header className="sticky top-0 z-10 bg-white" style={{ borderBottom: `3px solid ${PRIMARY}` }}>
      <div className="w-full flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Replace with <img src="/mcmaster-logo.png" /> when available */}
          <div className="h-10 w-10 rounded bg-gray-200 grid place-items-center text-xs">Logo</div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: PRIMARY }}>CAS Department</h1>
            <div className="text-sm text-gray-600">TA Application Portal (Prototype)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("student")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "student" ? "text-white" : ""}`}
            style={{ background: tab === "student" ? PRIMARY : "white", color: tab === "student" ? "white" : PRIMARY, borderColor: PRIMARY }}
          >
            Student
          </button>
          <button
            onClick={() => setTab("professor")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "professor" ? "text-white" : ""}`}
            style={{ background: tab === "professor" ? PRIMARY : "white", color: tab === "professor" ? "white" : PRIMARY, borderColor: PRIMARY }}
          >
            Professor
          </button>
          {/* 🧹 Reset Portal */}
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ background: "white", color: PRIMARY, borderColor: PRIMARY }}
          >
            Reset Portal
          </button>
        </div>
      </div>
      {tab === "student" && (
        <div className="w-full px-6 pb-2 flex gap-2">
          <button
            onClick={() => setStudentSubTab("postings")}
            className={`px-3 py-1 rounded-md text-sm border ${studentSubTab === "postings" ? "text-white" : ""}`}
            style={{ background: studentSubTab === "postings" ? PRIMARY : "white", color: studentSubTab === "postings" ? "white" : PRIMARY, borderColor: PRIMARY }}
          >
            Postings
          </button>
          <button
            onClick={() => setStudentSubTab("account")}
            className={`px-3 py-1 rounded-md text-sm border ${studentSubTab === "account" ? "text-white" : ""}`}
            style={{ background: studentSubTab === "account" ? PRIMARY : "white", color: studentSubTab === "account" ? "white" : PRIMARY, borderColor: PRIMARY }}
          >
            My Account
          </button>
        </div>
      )}
    </header>
  );
}

// ---------------- Student: Browse-only ----------------
function StudentBrowse({ postings, onSubmitted, setApplications }){
  const [active, setActive] = useState(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return postings;
    return postings.filter(p => [p.code, p.title, p.professor].some(f => f.toLowerCase().includes(s)));
  }, [q, postings]);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>Browse TA Postings</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded-xl bg-white px-3 py-2 w-full max-w-xl" style={{ borderColor: PRIMARY }}>
            <Search className="h-4 w-4" color={PRIMARY} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by code, title, professor…"
              className="w-full outline-none text-sm"
            />
          </div>
          <button className="border rounded-xl px-3 py-2 text-sm flex items-center gap-1" style={{ borderColor: PRIMARY, color: PRIMARY }}>
            <Filter className="h-4 w-4" />Filters
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-white p-4">
              <div className="font-semibold">{p.title}</div>
              <dl className="mt-2 text-sm text-gray-700 space-y-1">
                <div><span className="font-medium">Professor:</span> {p.professor}</div>
                <div><span className="font-medium">Your previous grade:</span> {p.studentPrevGrade}</div>
                <div><span className="font-medium">Class time:</span> {p.classTime}</div>
              </dl>
              <button onClick={() => setActive(p)} className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-medium text-white" style={{ background: PRIMARY }}>View details</button>
            </div>
          ))}
        </div>
      </section>

      {active && (
        <Dialog onClose={() => setActive(null)}>
          <PostingDetails
            posting={active}
            onApply={(payload) => {
              // optional uploads: only reject if provided non-PDF
              if (!validateOptionalUploads(payload)) {
                alert("If you upload files, they must be PDFs.");
                return;
              }
              const app = {
                id: cryptoId(),
                postingId: active.id,
                course: active.title,
                status: "submitted",
                resume: payload.resume || null,
                transcript: payload.transcript || null,
                createdAt: Date.now(),
              };
              setApplications((a) => [app, ...a]);
              setActive(null);
              onSubmitted(active.code);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

// ---------------- Student: Account (shows status) ----------------
function StudentAccount({ applications }){
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>My Applications</h2>
      {applications.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="font-medium" style={{ color: PRIMARY }}>No applications yet</div>
          <div className="text-sm text-gray-600">Apply from the Postings tab.</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {applications.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-white p-4">
              <div className="font-medium" style={{ color: PRIMARY }}>{a.course}</div>
              <div className="text-sm text-gray-600">{a.postingId} • {new Date(a.createdAt).toLocaleString()}</div>
              <div className="mt-2 flex items-center gap-2">
                <StatusChip status={a.status} />
                {a.nextStep && <span className="text-xs text-gray-700">Next step: <span className="font-semibold">{a.nextStep}</span></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusChip({ status }) {
  const map = ({
    submitted: { bg: "#FBE6F0", fg: PRIMARY, label: "Submitted" },
    reviewed: { bg: "#FFEB99", fg: PRIMARY, label: "Reviewed" },
    interview: { bg: "#E9F5FF", fg: "#0C4A6E", label: "Interview" },
    accepted: { bg: "#E8F5E9", fg: "#1B5E20", label: "Accepted" },
    rejected: { bg: "#FDE7EA", fg: PRIMARY, label: "Rejected" },
  })[status] || { bg: "#EEE", fg: "#555", label: status };
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: map.bg, color: map.fg }}>
      {map.label}
    </span>
  );
}

function PostingDetails({ posting, onApply }) {
  const [resume, setResume] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [note, setNote] = useState("");

  return (
    <div className="w-full max-w-2xl">
      <div className="text-lg font-semibold" style={{ color: PRIMARY }}>{posting.title}</div>
      <div className="text-sm text-gray-600">{posting.code} • {posting.professor}</div>

      {posting.studentPrevGrade && (
        <div className="mt-1 text-sm"><span className="font-medium">Your previous grade:</span> {posting.studentPrevGrade}</div>
      )}
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="font-medium flex items-center gap-2"><Clock className="h-4 w-4"/>Class Time</div>
          <div className="text-sm mt-1">{posting.classTime}</div>
          <div className="font-medium mt-3">Possible TA Tutorial Times</div>
          <ul className="list-disc pl-5 text-sm mt-1 space-y-0.5">
            {posting.tutorialSlots.map((t,i)=>(<li key={i}>{t.day} {t.start}–{t.end}</li>))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <div className="font-medium flex items-center gap-2"><Calendar className="h-4 w-4"/>Schedule Preview</div>
          <SchedulePreview tutorialSlots={posting.tutorialSlots} />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-3 mt-3 grid gap-3">
        <label className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4"/> Upload Resume (PDF) <span className="text-gray-500">(optional)</span></label>
        <input type="file" accept=".pdf,application/pdf" onChange={(e) => setResume(e.target.files?.[0] || null)} className="text-sm" />

        <label className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4"/> Upload Transcript (PDF) <span className="text-gray-500">(optional)</span></label>
        <input type="file" accept=".pdf,application/pdf" onChange={(e) => setTranscript(e.target.files?.[0] || null)} className="text-sm" />
      </div>

      <div className="rounded-xl border bg-white p-3 mt-3 grid gap-2">
        <label className="text-sm font-medium">Optional note to professor</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="border rounded-xl px-3 py-2 text-sm" />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="border rounded-xl px-4 py-2 text-sm"
          style={{ borderColor: PRIMARY, color: PRIMARY }}
          onClick={() => onApply({ resume, transcript, note })}
        >
          Submit Application
        </button>
      </div>
    </div>
  );
}

function SchedulePreview({ tutorialSlots }){
  const days = ["Mon","Tue","Wed","Thu","Fri"];
  const hasConflict = (slot) => STUDENT_CLASSES.some(c => c.day===slot.day && !(slot.end <= c.start || slot.start >= c.end));
  return (
    <div className="text-xs">
      <div className="grid grid-cols-5 gap-1">
        {days.map(d => (
          <div key={d} className="text-center font-medium text-gray-700">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 mt-1">
        {days.map(d => {
          const slot = tutorialSlots.find(s=>s.day===d);
          if(!slot) return <div key={d} className="h-16 rounded-md bg-gray-100"/>;
          const conflict = hasConflict(slot);
          return (
            <div key={d} className="h-16 rounded-md flex items-center justify-center" style={{ background: conflict? "#FDE7EA" : "#E8F5E9", color: conflict? "#7A003C":"#1B5E20" }}>
              {slot.start}–{slot.end}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-700">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm inline-block" style={{ background: "#E8F5E9" }}/><Check className="h-3 w-3"/>No Conflict</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm inline-block" style={{ background: "#FDE7EA" }}/><X className="h-3 w-3"/>Conflict</span>
      </div>
    </div>
  );
}

// ---------------- Professor ----------------
function ProfessorView({ postings, applications, setApplications, pingStudent, profPostingId, setProfPostingId }){
  const [active, setActive] = useState(null);

  const profPosting = postings.find(p => p.id === profPostingId) ?? postings[0];
  const appsForCourse = useMemo(() => applications.filter(a => a.postingId === profPosting.id), [applications, profPosting.id]);

  // Sanity: ensure no leakage from other courses
  useEffect(() => {
    const leak = applications.some(a => a.postingId !== profPosting.id && appsForCourse.includes(a));
    console.assert(!leak, "Professor view should only list apps for the selected course");
  }, [applications, profPosting.id, appsForCourse]);

  return (
    <div className="grid gap-6">
      {/* Professor account selector */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: PRIMARY }}>
          Logged in as: <span className="font-semibold">{profPosting.professor}</span> (Course: {profPosting.code})
        </div>
        <div className="mt-2">
          <label className="text-sm text-gray-700">Switch Professor Account (one course per account)</label>
          <select
            className="mt-1 border rounded-lg px-3 py-2 text-sm"
            style={{ borderColor: PRIMARY }}
            value={profPosting.id}
            onChange={(e)=>setProfPostingId(e.target.value)}
          >
            {postings.map(p => (
              <option key={p.id} value={p.id}>{p.professor} — {p.code}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>Applications – {profPosting.title}</h2>
        <div className="grid gap-4">
          <div className="rounded-2xl border bg-white p-4">
            {appsForCourse.length === 0 ? (
              <div className="text-sm text-gray-600 mt-2">No applicants yet.</div>
            ) : (
              <div className="mt-3 grid gap-2">
                {appsForCourse.map((a) => (
                  <div key={a.id} className="rounded-xl border px-3 py-2 bg-slate-50 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">Applicant #{a.id.slice(-5)}</div>
                      <div className="text-gray-600">{a.course}</div>
                      <div className="mt-1"><StatusChip status={a.status} /></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="border rounded-lg px-3 py-1.5 text-sm"
                        style={{ borderColor: PRIMARY, color: PRIMARY }}
                        onClick={() => setActive(a)}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {active && (
        <Dialog onClose={()=>setActive(null)}>
          <div className="w-full max-w-xl">
            <div className="text-lg font-semibold" style={{ color: PRIMARY }}>Application – {active.course}</div>
            <div className="text-sm text-gray-600">ID: {active.id}</div>
            <div className="rounded-xl border bg-white p-3 mt-3">
              <div className="font-medium">Uploaded Files</div>
              <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                <li>Resume: {active.resume?.name || 'N/A'}</li>
                <li>Transcript: {active.transcript?.name || 'N/A'}</li>
              </ul>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                className="border rounded-xl px-4 py-2 text-sm"
                style={{ borderColor: PRIMARY, color: PRIMARY }}
                onClick={() => {
                  setApplications((list) => list.map((x) => x.id === active.id ? { ...x, status: 'reviewed' } : x));
                  pingStudent(`${active.postingId} marked Reviewed`);
                  setActive(null);
                }}
              >
                Mark Reviewed
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------------- Primitives ----------------
function Dialog({ children, onClose }){
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 grid place-items-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />
      {/* Modal content */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl border"
        style={{ borderColor: PRIMARY }}
      ><q></q>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 border rounded-lg px-2 py-1 text-xs"
          style={{ borderColor: PRIMARY, color: PRIMARY }}
        >
          Close
        </button>
        {children}
      </motion.div>
    </div>
  );
}

// ---------------- Id Helper ----------------
function cryptoId() {
  if (window.crypto?.getRandomValues) {
    const a = new Uint32Array(2);
    window.crypto.getRandomValues(a);
    return Array.from(a).map((x) => x.toString(16).padStart(8, "0")).join("");
  }
  return Math.random().toString(36).slice(2);
}
