import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Row } from "../../shared/schemas";
import { maxForms } from "../../shared/forms";
import { applicationBook, applicationsKey, newApplication, readApplications, type Application, type Book } from "../lib/applications";
import { readRows } from "../lib/archive";
import { ApplicationEntry } from "./ApplicationEntry";
import { ApplicationDetail } from "./ApplicationDetail";
import "./applications.css";

type AnswerDraft = { applicationId: string; value: string };
type Mutation = (book: Book) => void;
export function Applications({ rows, beforeLeave }: {
  rows: Row[]; beforeLeave: RefObject<(() => boolean) | null>;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [active, setActive] = useState<string | null>(null), [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const pending = useRef(drafts), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commit = useCallback((mutate?: Mutation) => {
    clearTimeout(timer.current);
    if (!mutate && !Object.keys(pending.current).length) return true;
    try {
      const latest = readApplications(localStorage);
      for (const [id, draft] of Object.entries(pending.current)) {
        const app = latest.applications.find(a => a.id === draft.applicationId);
        const q = app?.questions.find(q => q.id === id);
        if (app && q && q.answer !== draft.value) { q.answer = draft.value; app.updatedAt = Date.now(); }
      }
      mutate?.(latest);
      applicationBook.parse(latest);
      localStorage.setItem(applicationsKey, JSON.stringify(latest));
      pending.current = {};
      setDrafts(pending.current);
      setBook(latest);
      setError("");
      return true;
    } catch (err) {
      setError(err instanceof Error && err.name === "Error" ? err.message : "지원서를 저장하지 못했어요. 브라우저 저장 권한과 남은 공간을 확인해 주세요.");
      return false;
    }
  }, []);
  useEffect(() => {
    function refresh() {
      try { setBook(readApplications(localStorage)); setError(""); }
      catch { setError("지원서를 읽을 수 없어요. 브라우저 저장소를 확인해 주세요."); }
    }
    refresh();
    const sync = (e: StorageEvent) => { if (e.key === applicationsKey || e.key === null) refresh(); };
    const flush = () => commit();
    beforeLeave.current = flush;
    window.addEventListener("storage", sync);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(timer.current);
      beforeLeave.current = null;
      window.removeEventListener("storage", sync);
      window.removeEventListener("pagehide", flush);
    };
  }, [commit, beforeLeave]);
  const current = book?.applications.find(a => a.id === active);
  function validateLink(app: Application) {
    if (app.rowId && !readRows(localStorage).some(r => r.id === app.rowId)) {
      app.deletedTitle = rows.find(r => r.id === app.rowId)?.title;
      app.rowId = null;
    }
  }
  return <section className="applications">
    <datalist id="question-limits"><option value="제한 없음" /><option value="확인 필요" /></datalist>
    {error && !adding && <p role="alert">{error}</p>}
    {current ? <ApplicationDetail key={current.id} rows={rows}
      app={{ ...current, questions: current.questions.map(q => ({ ...q, answer: drafts[q.id]?.value ?? q.answer })) }}
      back={() => { if (commit()) setActive(null); }} flush={commit}
      answer={(id, value) => {
        pending.current = { ...pending.current, [id]: { applicationId: current.id, value } };
        setDrafts(pending.current);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(), 500);
      }}
      update={fn => commit(latest => {
        const app = latest.applications.find(a => a.id === current.id);
        if (!app) throw Error("다른 탭에서 지원서가 삭제됐어요.");
        fn(app);
        validateLink(app);
        app.updatedAt = Date.now();
      })} /> : <>
      <div className="sectionTitle"><h1>지원서 매니저</h1><button className="primary"
        disabled={!book || book.applications.length >= maxForms}
        onClick={() => { setError(""); setAdding(true); }}>+ 지원서 추가</button></div>
      {book && book.applications.length >= maxForms && <p>지원서는 30개까지 만들 수 있어요.</p>}
      {book && !book.applications.length && <p>아직 저장한 지원서가 없어요.</p>}
      <div className="application-list">{[...(book?.applications ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).map(app => {
        const row = rows.find(r => r.id === app.rowId);
        return <article key={app.id} className="application-card">
          <button className="application-open" onClick={() => setActive(app.id)}>
            <strong>{app.title}</strong>
            {row && <span>마감일 {row.endDate || "확인 필요"}</span>}
            {app.deletedTitle && <span>(삭제된 공고) {app.deletedTitle}</span>}
            <span>질문 {app.questions.length}개 · 완료 {app.questions.filter(q => q.done).length}/{app.questions.length}</span>
            <small>최근 수정 {new Date(app.updatedAt).toLocaleString("ko-KR")}</small>
          </button>
          <button className="application-delete" aria-label={`지원서 삭제: ${app.title}`} onClick={() => {
            if (window.confirm("이 지원서를 삭제할까요? 답변도 모두 삭제돼요"))
              commit(latest => { latest.applications = latest.applications.filter(a => a.id !== app.id); });
          }}>삭제</button>
        </article>;
      })}</div>
    </>}
    {adding && <ApplicationEntry rows={rows} close={() => { setAdding(false); setError(""); }} saveError={error}
      save={(title, rowId, fields, commonRequirements) => {
        const app = newApplication(title, rowId, fields, commonRequirements);
        if (commit(latest => {
          if (latest.applications.length >= maxForms) throw Error("지원서는 30개까지 만들 수 있어요.");
          validateLink(app);
          latest.applications.push(app);
        })) { setAdding(false); setActive(app.id); }
      }} />}
  </section>;
}
