import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  Bell,
  Calendar,
  Clock,
  Check,
  X,
  Upload,
} from "lucide-react";

/**
 * CAS Department – TA Application Portal (Frontend Only, Preview)
 * - Student sees status ONLY in My Applications (not on Postings)
 * - Resume upload REQUIRED (PDF); Transcript uploads OPTIONAL (PDF)
 * - Multiple professor accounts (one course per account) with switcher
 * - Professors can close/reopen postings (students see closed state)
 * - Students can view, edit note, withdraw, and delete withdrawn applications
 * - Same student can have at most ONE active application per course
 *   (withdrawn applications don't block reapplying)
 * - Re-submitting for same course updates the existing active application
 * - Saved documents (prototype-only): default resume/transcript for quick apply
 * - When uploading resume/transcript, ask if user wants to set/replace defaults
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
    closed: false,
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
    closed: false,
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
  get(k: string, fallback: any) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: any) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      // ignore
    }
  },
};

// ---------------- Utility & Tests ----------------
function isPdf(file: any) {
  if (!file) return false;
  const okMime = file.type === "application/pdf";
  const okExt = file.name?.toLowerCase().endsWith(".pdf");
  return !!(okMime || okExt);
}

/**
 * 强校验版本：
 * - resume 必须存在且是 PDF
 * - transcript 可选，但如果提供也必须是 PDF
 */
function validateApplicationInputs(payload: {
  resume: any;
  transcript?: any;
} | null) {
  if (!payload) return { ok: false, msg: "No data provided." };
  const { resume, transcript } = payload;
  if (!resume) return { ok: false, msg: "Please upload your resume as a PDF." };
  if (!isPdf(resume)) return { ok: false, msg: "Resume must be a PDF file." };
  if (transcript && !isPdf(transcript)) {
    return { ok: false, msg: "Transcript must be a PDF file." };
  }
  return { ok: true };
}

// Legacy helper (still used by inline tests)
function validateOptionalUploads(payload: any) {
  if (!payload) return true;
  const { resume, transcript } = payload;
  if (resume && !isPdf(resume)) return false;
  if (transcript && !isPdf(transcript)) return false;
  return true;
}

// Inline non-breaking tests
(function runInlineTests() {
  console.assert(
    isPdf({ name: "a.pdf", type: "application/pdf" }) === true,
    "isPdf: accept proper PDF"
  );
  console.assert(
    isPdf({ name: "a.PDF", type: "" }) === true,
    "isPdf: accept .PDF ext"
  );
  console.assert(
    isPdf({ name: "a.txt", type: "text/plain" }) === false,
    "isPdf: reject non-PDF"
  );
  console.assert(
    validateOptionalUploads(null) === true,
    "optional: null payload ok"
  );
  console.assert(
    validateOptionalUploads({}) === true,
    "optional: both missing ok"
  );
  console.assert(
    validateOptionalUploads({
      resume: { name: "r.pdf", type: "application/pdf" },
    }) === true,
    "optional: single valid ok"
  );
  console.assert(
    validateOptionalUploads({
      transcript: { name: "t.txt", type: "text/plain" },
    }) === false,
    "optional: non-PDF should fail"
  );
  // extra tests for strict application validation
  console.assert(
    validateApplicationInputs({
      resume: { name: "r.pdf", type: "application/pdf" },
      transcript: undefined,
    }).ok === true,
    "validateApplicationInputs: valid resume passes"
  );
  console.assert(
    validateApplicationInputs({
      resume: { name: "r.txt", type: "text/plain" },
      transcript: undefined,
    }).ok === false,
    "validateApplicationInputs: non-PDF resume fails"
  );
})();

// ---------------- App ----------------
function App() {
  // top-level tabs
  const [tab, setTab] = useState<"student" | "professor">("student");
  const [studentSubTab, setStudentSubTab] = useState<"postings" | "account">(
    "postings"
  );

  // postings (professors can close/reopen)
  const [postings, setPostings] = useState(INITIAL_POSTINGS);

  // professor account selection (one course per prof account)
  const [profPostingId, setProfPostingId] = useState(() =>
    storage.get("profPostingId", INITIAL_POSTINGS[0]?.id || "")
  );
  useEffect(() => storage.set("profPostingId", profPostingId), [profPostingId]);

  // applications
  const [applications, setApplications] = useState<any[]>(() =>
    storage.get("apps", [])
  );
  useEffect(() => storage.set("apps", applications), [applications]);

  // Saved documents (front-end only, per-session)
  const [defaultResume, setDefaultResume] = useState<File | null>(null);
  const [defaultTranscript, setDefaultTranscript] = useState<File | null>(null);

  // toasts
  const [toasts, setToasts] = useState<
    { id: string; title: string; body: string }[]
  >([]);
  const notify = (title: string, body: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <Header
        tab={tab}
        setTab={setTab}
        studentSubTab={studentSubTab}
        setStudentSubTab={setStudentSubTab}
        applicationCount={applications.length}
      />

      <main className="w-full px-8 py-6 max-w-6xl mx-auto">
        {tab === "student" ? (
          studentSubTab === "postings" ? (
            <StudentBrowse
              postings={postings}
              applications={applications}
              onSubmitted={(courseCode) =>
                notify("Application Submitted", `${courseCode}`)
              }
              setApplications={setApplications}
              defaultResume={defaultResume}
              defaultTranscript={defaultTranscript}
              setDefaultResume={setDefaultResume}
              setDefaultTranscript={setDefaultTranscript}
            />
          ) : (
            <StudentAccount
              applications={applications}
              setApplications={setApplications}
              defaultResume={defaultResume}
              defaultTranscript={defaultTranscript}
              setDefaultResume={setDefaultResume}
              setDefaultTranscript={setDefaultTranscript}
            />
          )
        ) : (
          <ProfessorView
            postings={postings}
            setPostings={setPostings}
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
                <div className="font-medium" style={{ color: PRIMARY }}>
                  {t.title}
                </div>
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
function Header(props: {
  tab: "student" | "professor";
  setTab: (t: "student" | "professor") => void;
  studentSubTab: "postings" | "account";
  setStudentSubTab: (s: "postings" | "account") => void;
  applicationCount: number;
}) {
  const {
    tab,
    setTab,
    studentSubTab,
    setStudentSubTab,
    applicationCount = 0,
  } = props;

  return (
    <header
      className="sticky top-0 z-10 bg-white"
      style={{ borderBottom: `3px solid ${PRIMARY}` }}
    >
      <div className="w-full flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <img
            src="/mcmaster-logo.png"
            alt="McMaster University"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: PRIMARY }}>
              CAS Department
            </h1>
            <div className="text-sm text-gray-600">
              TA Application Portal (Prototype)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("student")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              tab === "student" ? "text-white" : ""
            }`}
            style={{
              background: tab === "student" ? PRIMARY : "white",
              color: tab === "student" ? "white" : PRIMARY,
              borderColor: PRIMARY,
            }}
          >
            Student
          </button>
          <button
            onClick={() => setTab("professor")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              tab === "professor" ? "text-white" : ""
            }`}
            style={{
              background: tab === "professor" ? PRIMARY : "white",
              color: tab === "professor" ? "white" : PRIMARY,
              borderColor: PRIMARY,
            }}
          >
            Professor
          </button>
          {/* 🧹 Reset Portal */}
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ background: "white", color: PRIMARY, borderColor: PRIMARY }}
          >
            Reset Portal
          </button>
        </div>
      </div>
      {tab === "student" && (
        <div className="w-full px-6 pb-2 flex gap-2 max-w-6xl mx-auto">
          <button
            onClick={() => setStudentSubTab("postings")}
            className={`px-3 py-1 rounded-md text-sm border ${
              studentSubTab === "postings" ? "text-white" : ""
            }`}
            style={{
              background: studentSubTab === "postings" ? PRIMARY : "white",
              color: studentSubTab === "postings" ? "white" : PRIMARY,
              borderColor: PRIMARY,
            }}
          >
            Postings
          </button>
          <button
            onClick={() => setStudentSubTab("account")}
            className={`px-3 py-1 rounded-md text-sm border ${
              studentSubTab === "account" ? "text-white" : ""
            }`}
            style={{
              background: studentSubTab === "account" ? PRIMARY : "white",
              color: studentSubTab === "account" ? "white" : PRIMARY,
              borderColor: PRIMARY,
            }}
          >
            My Applications
            {applicationCount > 0 && (
              <span className="ml-1 text-xs">({applicationCount})</span>
            )}
          </button>
        </div>
      )}
    </header>
  );
}

// ---------------- Student: Browse-only ----------------
function StudentBrowse(props: {
  postings: any[];
  applications: any[];
  onSubmitted: (code: string) => void;
  setApplications: React.Dispatch<React.SetStateAction<any[]>>;
  defaultResume: File | null;
  defaultTranscript: File | null;
  setDefaultResume: (f: File | null) => void;
  setDefaultTranscript: (f: File | null) => void;
}) {
  const {
    postings,
    applications,
    onSubmitted,
    setApplications,
    defaultResume,
    defaultTranscript,
    setDefaultResume,
    setDefaultTranscript,
  } = props;
  const [active, setActive] = useState<any | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return postings;
    return postings.filter((p) =>
      [p.code, p.title, p.professor].some((f: string) =>
        f.toLowerCase().includes(s)
      )
    );
  }, [q, postings]);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>
          Browse TA Postings
        </h2>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 border rounded-xl bg-white px-3 py-2 w-full max-w-xl"
            style={{ borderColor: PRIMARY }}
          >
            <Search className="h-4 w-4" color={PRIMARY} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by code, title, professor…"
              className="w-full outline-none text-sm"
            />
          </div>
          <button
            className="border rounded-xl px-3 py-2 text-sm flex items-center gap-1"
            style={{ borderColor: PRIMARY, color: PRIMARY }}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            // 只把非 withdrawn 的申请算作“已申请”
            const hasApplied = applications.some(
              (a) => a.postingId === p.id && a.status !== "withdrawn"
            );

            return (
              <div
                key={p.id}
                className="rounded-2xl border bg-white p-4 flex flex-col"
              >
                <div className="font-semibold">{p.title}</div>
                <dl className="mt-2 text-sm text-gray-700 space-y-1">
                  <div>
                    <span className="font-medium">Professor:</span>{" "}
                    {p.professor}
                  </div>
                  <div>
                    <span className="font-medium">Your previous grade:</span>{" "}
                    {p.studentPrevGrade}
                  </div>
                  <div>
                    <span className="font-medium">Class time:</span>{" "}
                    {p.classTime}
                  </div>
                </dl>

                {/* 状态标签：closed / 已申请 */}
                {p.closed && (
                  <span className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-700">
                    Applications closed
                  </span>
                )}
                {!p.closed && hasApplied && (
                  <span className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700">
                    Already applied
                  </span>
                )}

                {/* Apply 按钮：没申请时可点，申请后灰掉；withdraw 后可重新变成可点 */}
                <button
                  onClick={() => {
                    if (!p.closed && !hasApplied) {
                      setActive(p); // 只有“第一次 / withdraw 后重新申请”才弹出表单
                    }
                  }}
                  disabled={p.closed || hasApplied}
                  className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
                  style={{
                    background:
                      p.closed || hasApplied ? "#E5E7EB" : PRIMARY,
                    color:
                      p.closed || hasApplied ? "#6B7280" : "white",
                  }}
                >
                  {p.closed
                    ? "Closed"
                    : hasApplied
                    ? "Applied"
                    : "Apply"}
                </button>

                {hasApplied && !p.closed && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    To edit this application, go to{" "}
                    <span className="font-semibold">My Applications</span>.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {active && (
        <Dialog onClose={() => setActive(null)}>
          <PostingDetails
            posting={active}
            defaultResume={defaultResume}
            defaultTranscript={defaultTranscript}
            onApply={(payload) => {
              // 找这门课是否有“非 withdrawn 的现有申请”
              const existing = applications.find(
                (a) => a.postingId === active.id && a.status !== "withdrawn"
              );

              // 先决定这次真正要用哪份 resume / transcript
              const chosenResume =
                payload.resume || existing?.resume || null;
              const chosenTranscript =
                payload.transcript || existing?.transcript || null;

              const result = validateApplicationInputs({
                resume: chosenResume,
                transcript: chosenTranscript,
              });
              if (!result.ok) {
                alert(result.msg);
                return;
              }

              // 询问是否设置/覆盖 default resume
              if (chosenResume) {
                if (!defaultResume) {
                  const wantsDefault = window.confirm(
                    "Do you want to save this resume as your default resume for future applications?"
                  );
                  if (wantsDefault) {
                    setDefaultResume(chosenResume);
                  }
                } else if (chosenResume !== defaultResume) {
                  const overwrite = window.confirm(
                    "You already have a default resume. Replace it with this file?"
                  );
                  if (overwrite) {
                    setDefaultResume(chosenResume);
                  }
                }
              }

              // 询问是否设置/覆盖 default transcript（如果有传）
              if (chosenTranscript) {
                if (!defaultTranscript) {
                  const wantsDefault = window.confirm(
                    "Do you want to save this transcript as your default transcript?"
                  );
                  if (wantsDefault) {
                    setDefaultTranscript(chosenTranscript);
                  }
                } else if (chosenTranscript !== defaultTranscript) {
                  const overwrite = window.confirm(
                    "You already have a default transcript. Replace it with this file?"
                  );
                  if (overwrite) {
                    setDefaultTranscript(chosenTranscript);
                  }
                }
              }

              // 更新 application，统一用 chosenResume / chosenTranscript
              if (existing) {
                setApplications((list) =>
                  list.map((a) =>
                    a.id === existing.id
                      ? {
                          ...a,
                          resume: chosenResume,
                          transcript: chosenTranscript,
                          note:
                            payload.note &&
                            payload.note.trim().length > 0
                              ? payload.note
                              : a.note,
                        }
                      : a
                  )
                );
                setActive(null);
                onSubmitted(`${active.code} updated`);
              } else {
                const app = {
                  id: cryptoId(),
                  postingId: active.id,
                  course: active.title,
                  status: "submitted",
                  resume: chosenResume,
                  transcript: chosenTranscript,
                  note: payload.note || "",
                  nextStep: "Awaiting review",
                  createdAt: Date.now(),
                };
                setApplications((a) => [app, ...a]);
                setActive(null);
                onSubmitted(active.code);
              }
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

// ---------------- Student: Account (shows status + saved docs) ----------------
function StudentAccount(props: {
  applications: any[];
  setApplications: React.Dispatch<React.SetStateAction<any[]>>;
  defaultResume: File | null;
  defaultTranscript: File | null;
  setDefaultResume: (f: File | null) => void;
  setDefaultTranscript: (f: File | null) => void;
}) {
  const {
    applications,
    setApplications,
    defaultResume,
    defaultTranscript,
    setDefaultResume,
    setDefaultTranscript,
  } = props;

  const [activeApp, setActiveApp] = useState<any | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editResume, setEditResume] = useState<any | null>(null);
  const [editTranscript, setEditTranscript] = useState<any | null>(null);

  const handleOpenApp = (app: any) => {
    setActiveApp(app);
    setEditNote(app.note || "");
    setEditResume(null);
    setEditTranscript(null);
  };

  const handleSaveChanges = () => {
    if (!activeApp) return;

    const finalResume = editResume || activeApp.resume;
    const finalTranscript = editTranscript || activeApp.transcript;

    const result = validateApplicationInputs({
      resume: finalResume,
      transcript: finalTranscript,
    });
    if (!result.ok) {
      alert(result.msg);
      return;
    }

    // 如果这次真的上传了新 resume，则问要不要设/覆盖 default
    if (editResume) {
      if (!defaultResume) {
        const wantsDefault = window.confirm(
          "Do you want to save this resume as your default resume for future applications?"
        );
        if (wantsDefault) {
          setDefaultResume(editResume);
        }
      } else if (editResume !== defaultResume) {
        const overwrite = window.confirm(
          "You already have a default resume. Replace it with this file?"
        );
        if (overwrite) {
          setDefaultResume(editResume);
        }
      }
    }

    // 如果这次真的上传了新 transcript，则问要不要设/覆盖 default
    if (editTranscript) {
      if (!defaultTranscript) {
        const wantsDefault = window.confirm(
          "Do you want to save this transcript as your default transcript?"
        );
        if (wantsDefault) {
          setDefaultTranscript(editTranscript);
        }
      } else if (editTranscript !== defaultTranscript) {
        const overwrite = window.confirm(
          "You already have a default transcript. Replace it with this file?"
        );
        if (overwrite) {
          setDefaultTranscript(editTranscript);
        }
      }
    }

    setApplications((list) =>
      list.map((a) =>
        a.id === activeApp.id
          ? {
              ...a,
              resume: finalResume,
              transcript: finalTranscript,
              note: editNote,
            }
          : a
      )
    );
    setActiveApp(null);
  };

  const handleWithdraw = (id: string) => {
    const sure = window.confirm(
      "Are you sure you want to withdraw this application?"
    );
    if (!sure) return;
    setApplications((list) =>
      list.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "withdrawn",
              nextStep: "Application withdrawn by student",
            }
          : a
      )
    );
  };

  const handleDelete = (id: string) => {
    const sure = window.confirm(
      "Delete this withdrawn application record? This cannot be undone."
    );
    if (!sure) return;
    setApplications((list) => list.filter((a) => a.id !== id));
  };

  return (
    <section className="grid gap-4">
      {/* Saved documents panel – 文档库 / Quick Apply */}
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="text-sm font-semibold" style={{ color: PRIMARY }}>
          Saved documents (prototype)
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          Set a default resume and transcript to reuse across applications.
          In this prototype, files are only stored in your current browser
          session (a real system would save them on the server).
        </p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
          <div className="grid gap-1">
            <span className="font-medium">Default resume (PDF)</span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setDefaultResume(e.target.files?.[0] || null)}
            />
            <span className="text-xs text-gray-500">
              {defaultResume
                ? `Current: ${defaultResume.name}`
                : "Not set yet."}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="font-medium">
              Default transcript (PDF, optional)
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) =>
                setDefaultTranscript(e.target.files?.[0] || null)
              }
            />
            <span className="text-xs text-gray-500">
              {defaultTranscript
                ? `Current: ${defaultTranscript.name}`
                : "Not set yet."}
            </span>
          </div>
        </div>
      </div>

      {/* My Applications 列表 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>
          My Applications
        </h2>
        <div className="text-xs text-gray-600">
          Status is only visible here (not on Postings).
        </div>
      </div>
      {applications.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="font-medium" style={{ color: PRIMARY }}>
            No applications yet
          </div>
          <div className="text-sm text-gray-600">
            Apply from the Postings tab.
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {applications.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-white p-4">
              <div className="font-medium" style={{ color: PRIMARY }}>
                {a.course}
              </div>
              <div className="text-sm text-gray-600">
                {a.postingId} • {new Date(a.createdAt).toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusChip status={a.status} />
                {a.nextStep && (
                  <span className="text-xs text-gray-700">
                    Next step:{" "}
                    <span className="font-semibold">{a.nextStep}</span>
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    className="border rounded-lg px-3 py-1 text-xs"
                    style={{ borderColor: PRIMARY, color: PRIMARY }}
                    onClick={() => handleOpenApp(a)}
                  >
                    View / Edit
                  </button>
                  {/* active 状态可 Withdraw；withdrawn 状态可 Delete */}
                  {a.status !== "withdrawn" &&
                    a.status !== "rejected" &&
                    a.status !== "accepted" && (
                      <button
                        className="border rounded-lg px-3 py-1 text-xs text-red-700 border-red-300"
                        onClick={() => handleWithdraw(a.id)}
                      >
                        Withdraw
                      </button>
                    )}
                  {a.status === "withdrawn" && (
                    <button
                      className="border rounded-lg px-3 py-1 text-xs text-red-700 border-red-300"
                      onClick={() => handleDelete(a.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeApp && (
        <Dialog onClose={() => setActiveApp(null)}>
          <div className="w-full max-w-xl">
            <div className="text-lg font-semibold" style={{ color: PRIMARY }}>
              Application – {activeApp.course}
            </div>
            <div className="text-sm text-gray-600">ID: {activeApp.id}</div>

            <div className="rounded-xl border bg-white p-3 mt-3 grid gap-3">
              <div className="font-medium">Uploaded Files</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Current resume: {activeApp.resume?.name || "N/A"}</li>
                <li>
                  Current transcript: {activeApp.transcript?.name || "N/A"}
                </li>
              </ul>
              <div className="grid gap-2 text-sm">
                <label className="font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Replace resume (PDF)
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) =>
                    setEditResume(e.target.files?.[0] || null)
                  }
                  className="text-sm"
                />
                <label className="font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Replace transcript (PDF, optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) =>
                    setEditTranscript(e.target.files?.[0] || null)
                  }
                  className="text-sm"
                />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3 mt-3 grid gap-2">
              <label className="text-sm font-medium">Note to professor</label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                className="border rounded-xl px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500">
                You can update this note even after submission; the latest
                version will be visible to the professor.
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                className="border rounded-xl px-4 py-2 text-sm"
                style={{ borderColor: PRIMARY, color: PRIMARY }}
                onClick={handleSaveChanges}
              >
                Save changes
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function StatusChip({ status }: { status: string }) {
  const map =
    {
      submitted: { bg: "#FBE6F0", fg: PRIMARY, label: "Submitted" },
      reviewed: { bg: "#FFEB99", fg: PRIMARY, label: "Reviewed" },
      interview: { bg: "#E9F5FF", fg: "#0C4A6E", label: "Interview" },
      accepted: { bg: "#E8F5E9", fg: "#1B5E20", label: "Accepted" },
      rejected: { bg: "#FDE7EA", fg: PRIMARY, label: "Rejected" },
      withdrawn: { bg: "#ECEFF1", fg: "#455A64", label: "Withdrawn" },
    }[status] || { bg: "#EEE", fg: "#555", label: status };
  return (
    <span
      className="text-xs font-semibold px-2 py-1 rounded-full"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.label}
    </span>
  );
}

// ---------------- Posting Details ----------------
function PostingDetails(props: {
  posting: any;
  onApply: (payload: {
    resume: File | null;
    transcript: File | null;
    note: string;
  }) => void;
  defaultResume: File | null;
  defaultTranscript: File | null;
}) {
  const { posting, onApply, defaultResume, defaultTranscript } = props;
  const [resume, setResume] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<File | null>(null);
  const [note, setNote] = useState("");

  // 是否使用文档库里的默认文件
  const [useDefaultResume, setUseDefaultResume] = useState(!!defaultResume);
  const [useDefaultTranscript, setUseDefaultTranscript] = useState(false);

  const effectiveResume =
    useDefaultResume && defaultResume ? defaultResume : resume;
  const effectiveTranscript =
    useDefaultTranscript && defaultTranscript ? defaultTranscript : transcript;

  return (
    <div className="w-full max-w-2xl">
      <div className="text-lg font-semibold" style={{ color: PRIMARY }}>
        {posting.title}
      </div>
      <div className="text-sm text-gray-600">
        {posting.code} • {posting.professor}
      </div>

      {posting.studentPrevGrade && (
        <div className="mt-1 text-sm">
          <span className="font-medium">Your previous grade:</span>{" "}
          {posting.studentPrevGrade}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Class Time
          </div>
          <div className="text-sm mt-1">{posting.classTime}</div>
          <div className="font-medium mt-3">Possible TA Tutorial Times</div>
          <ul className="list-disc pl-5 text-sm mt-1 space-y-0.5">
            {posting.tutorialSlots.map((t: any, i: number) => (
              <li key={i}>
                {t.day} {t.start}–{t.end}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <div className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Preview
          </div>
          <SchedulePreview tutorialSlots={posting.tutorialSlots} />
        </div>
      </div>

      {/* Resume / Transcript 区域，带文档库选项 */}
      <div className="rounded-xl border bg-white p-3 mt-3 grid gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" /> Resume (PDF)
            <span className="text-red-600">*</span>
          </label>
          {defaultResume && (
            <span className="text-xs text-gray-500">
              Saved default: {defaultResume.name}
            </span>
          )}
        </div>

        {defaultResume && (
          <div className="text-xs text-gray-700 flex flex-col gap-1">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={`${posting.id}-resumeMode`}
                checked={useDefaultResume}
                onChange={() => setUseDefaultResume(true)}
              />
              Use my saved default resume
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={`${posting.id}-resumeMode`}
                checked={!useDefaultResume}
                onChange={() => setUseDefaultResume(false)}
              />
              Upload a different resume for this posting
            </label>
          </div>
        )}

        {/* 当选择“上传新的”时，显示文件输入；没有默认 resume 时也直接显示 */}
        {(!defaultResume || !useDefaultResume) && (
          <>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setResume(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Resume is required to submit your application.
            </p>
          </>
        )}

        <label className="text-sm font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" /> Transcript (PDF)
          <span className="text-gray-500">(optional)</span>
        </label>

        {defaultTranscript && (
          <label className="text-xs text-gray-700 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={useDefaultTranscript}
              onChange={(e) => setUseDefaultTranscript(e.target.checked)}
            />
            Use my saved default transcript ({defaultTranscript.name})
          </label>
        )}

        {(!defaultTranscript || !useDefaultTranscript) && (
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setTranscript(e.target.files?.[0] || null)}
            className="text-sm"
          />
        )}
      </div>

      <div className="rounded-xl border bg-white p-3 mt-3 grid gap-2">
        <label className="text-sm font-medium">Optional note to professor</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="border rounded-xl px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="border rounded-xl px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ borderColor: PRIMARY, color: PRIMARY }}
          onClick={() =>
            onApply({
              resume: effectiveResume,
              transcript: effectiveTranscript,
              note,
            })
          }
          disabled={posting.closed}
        >
          {posting.closed ? "Applications closed" : "Submit Application"}
        </button>
      </div>
    </div>
  );
}

function SchedulePreview({ tutorialSlots }: { tutorialSlots: any[] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const hasConflict = (slot: any) =>
    STUDENT_CLASSES.some(
      (c) => c.day === slot.day && !(slot.end <= c.start || slot.start >= c.end)
    );
  return (
    <div className="text-xs">
      <div className="grid grid-cols-5 gap-1">
        {days.map((d) => (
          <div key={d} className="text-center font-medium text-gray-700">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 mt-1">
        {days.map((d) => {
          const slot = tutorialSlots.find((s) => s.day === d);
          if (!slot)
            return <div key={d} className="h-16 rounded-md bg-gray-100" />;
          const conflict = hasConflict(slot);
          return (
            <div
              key={d}
              className="h-16 rounded-md flex items-center justify-center"
              style={{
                background: conflict ? "#FDE7EA" : "#E8F5E9",
                color: conflict ? "#7A003C" : "#1B5E20",
              }}
            >
              {slot.start}–{slot.end}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-700">
        <span className="inline-flex items-center gap-1">
          <span
            className="h-3 w-3 rounded-sm inline-block"
            style={{ background: "#E8F5E9" }}
          />
          <Check className="h-3 w-3" />
          No Conflict
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-3 w-3 rounded-sm inline-block"
            style={{ background: "#FDE7EA" }}
          />
          <X className="h-3 w-3" />
          Conflict
        </span>
      </div>
    </div>
  );
}

// ---------------- Professor ----------------
function ProfessorView(props: {
  postings: any[];
  setPostings: React.Dispatch<React.SetStateAction<any[]>>;
  applications: any[];
  setApplications: React.Dispatch<React.SetStateAction<any[]>>;
  pingStudent: (msg: string) => void;
  profPostingId: string;
  setProfPostingId: (id: string) => void;
}) {
  const {
    postings,
    setPostings,
    applications,
    setApplications,
    pingStudent,
    profPostingId,
    setProfPostingId,
  } = props;

  const [active, setActive] = useState<any | null>(null);

  const profPosting =
    postings.find((p) => p.id === profPostingId) ?? postings[0];
  const appsForCourse = useMemo(
    () => applications.filter((a) => a.postingId === profPosting.id),
    [applications, profPosting.id]
  );

  // Sanity: ensure no leakage from other courses
  useEffect(() => {
    const leak = applications.some(
      (a) => a.postingId !== profPosting.id && appsForCourse.includes(a)
    );
    console.assert(
      !leak,
      "Professor view should only list apps for the selected course"
    );
  }, [applications, profPosting.id, appsForCourse]);

  const toggleClosed = () => {
    setPostings((list) =>
      list.map((p) =>
        p.id === profPosting.id ? { ...p, closed: !p.closed } : p
      )
    );
  };

  const updateStatus = (
    app: any,
    status: "reviewed" | "interview" | "accepted" | "rejected"
  ) => {
    const defaultNextStepByStatus: Record<string, string> = {
      reviewed: "Your application has been reviewed.",
      interview: "You have been shortlisted for an interview.",
      accepted: "Offer extended. Please watch your email.",
      rejected: "You were not selected for this position.",
    };
    setApplications((list) =>
      list.map((a) =>
        a.id === app.id
          ? { ...a, status, nextStep: defaultNextStepByStatus[status] }
          : a
      )
    );
    pingStudent(`${app.postingId} status updated to ${status}`);
    setActive(null);
  };

  return (
    <div className="grid gap-6">
      {/* Professor account selector */}
      <section className="rounded-2xl border bg-white p-4">
        <div
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: PRIMARY }}
        >
          Logged in as:{" "}
          <span className="font-semibold">{profPosting.professor}</span>{" "}
          (Course: {profPosting.code})
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label className="text-sm text-gray-700">
              Switch Professor Account (one course per account)
            </label>
            <select
              className="mt-1 border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: PRIMARY }}
              value={profPosting.id}
              onChange={(e) => setProfPostingId(e.target.value)}
            >
              {postings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.professor} — {p.code}
                </option>
              ))}
            </select>
          </div>
          <button
            className="border rounded-lg px-3 py-2 text-sm mt-2 sm:mt-0"
            style={{
              borderColor: PRIMARY,
              color: profPosting.closed ? "#B91C1C" : PRIMARY,
            }}
            onClick={toggleClosed}
          >
            {profPosting.closed ? "Reopen Posting" : "Close Posting"}
          </button>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>
          Applications – {profPosting.title}
        </h2>
        <div className="grid gap-4">
          <div className="rounded-2xl border bg-white p-4">
            {appsForCourse.length === 0 ? (
              <div className="text-sm text-gray-600 mt-2">
                No applicants yet.
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {appsForCourse.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border px-3 py-2 bg-slate-50 flex items-center justify-between"
                  >
                    <div className="text-sm">
                      <div className="font-medium">
                        Applicant #{a.id.slice(-5)}
                      </div>
                      <div className="text-gray-600">{a.course}</div>
                      <div className="mt-1">
                        <StatusChip status={a.status} />
                      </div>
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
        <Dialog onClose={() => setActive(null)}>
          <div className="w-full max-w-xl">
            <div className="text-lg font-semibold" style={{ color: PRIMARY }}>
              Application – {active.course}
            </div>
            <div className="text-sm text-gray-600">ID: {active.id}</div>
            <div className="rounded-xl border bg-white p-3 mt-3">
              <div className="font-medium">Uploaded Files</div>
              <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                <li>Resume: {active.resume?.name || "N/A"}</li>
                <li>Transcript: {active.transcript?.name || "N/A"}</li>
              </ul>
            </div>
            <div className="rounded-xl border bg-white p-3 mt-3 grid gap-2">
              <div className="font-medium text-sm">Student note</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap min-h-[40px]">
                {active.note && active.note.trim()
                  ? active.note
                  : "(No note provided)"}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-3 mt-3 grid gap-2">
              <div className="font-medium text-sm">Update status</div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="border rounded-lg px-3 py-1.5 text-xs"
                  style={{ borderColor: PRIMARY, color: PRIMARY }}
                  onClick={() => updateStatus(active, "reviewed")}
                >
                  Mark Reviewed
                </button>
                <button
                  className="border rounded-lg px-3 py-1.5 text-xs"
                  style={{ borderColor: PRIMARY, color: PRIMARY }}
                  onClick={() => updateStatus(active, "interview")}
                >
                  Mark Interview
                </button>
                <button
                  className="border rounded-lg px-3 py-1.5 text-xs"
                  style={{ borderColor: "#16A34A", color: "#166534" }}
                  onClick={() => updateStatus(active, "accepted")}
                >
                  Accept
                </button>
                <button
                  className="border rounded-lg px-3 py-1.5 text-xs"
                  style={{ borderColor: "#DC2626", color: "#B91C1C" }}
                  onClick={() => updateStatus(active, "rejected")}
                >
                  Reject
                </button>
              </div>
              <p className="text-xs text-gray-500">
                When you update the status, the student will see the new status
                and next step in their "My Applications" tab.
              </p>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------------- Primitives ----------------
function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
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
      >
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
  if (
    typeof window !== "undefined" &&
    (window as any).crypto &&
    (window as any).crypto.getRandomValues
  ) {
    const a = new Uint32Array(2);
    (window as any).crypto.getRandomValues(a);
    return Array.from(a)
      .map((x) => x.toString(16).padStart(8, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2);
}

export default App;
