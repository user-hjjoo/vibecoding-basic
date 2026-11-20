import { useState } from "react";
import type { Row } from "../../shared/schemas";
import { emptyFields, maxAnswer, maxQuestions, takeChars, type Fields } from "../../shared/forms";
import { exportText, limitInfo, newQuestion, type Application, type Question } from "../lib/applications";
import { editable, parseFields, QuestionFields } from "./QuestionFields";

function QuestionEditor({ initial, save, cancel }: { initial: Fields; save: (f: Fields) => void; cancel: () => void }) {
  const [value, setValue] = useState(() => editable(initial));
  const parsed = parseFields(value);
  return <div><QuestionFields value={value} change={setValue} />
    <div className="app-actions"><button className="primary" disabled={!parsed} onClick={() => parsed && save(parsed)}>질문 저장</button>
      <button onClick={cancel}>취소</button></div></div>;
}

export function ApplicationDetail({ app, rows, back, update, answer, flush }: {
  app: Application; rows: Row[]; back: () => void;
  update: (fn: (latest: Application) => void) => boolean;
  answer: (id: string, value: string) => void; flush: () => boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const row = rows.find(r => r.id === app.rowId);
  function updateQuestion(id: string, change: (q: Question) => void) {
    return update(latest => {
      const q = latest.questions.find(item => item.id === id);
      if (!q) throw Error("질문이 변경됐어요. 목록을 다시 확인해 주세요.");
      change(q);
    });
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setFeedback("복사했어요"); }
    catch { setFeedback("복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요."); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportText(app)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = (app.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "") || "지원서") + ".txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <button onClick={back}>← 목록</button>
    <div className="application-heading"><h1>{app.title}</h1><span className="progress-chip">완료 {app.questions.filter(q => q.done).length}/{app.questions.length}</span></div>
    <div className="application-summary">
      <label>연결할 공고<select value={app.rowId ?? ""} onChange={e => {
        const id = e.target.value || null;
        update(latest => { latest.rowId = id; delete latest.deletedTitle; });
      }}><option value="">연결 안 함</option>{rows.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
      {row && <p>{row.title} · 마감일 {row.endDate || "확인 필요"}</p>}
      {app.commonRequirements && <div className="form-requirements"><strong>공통 요구사항</strong><p>{app.commonRequirements}</p></div>}
      {app.deletedTitle && <p>(삭제된 공고) {app.deletedTitle}</p>}
      <div className="app-actions"><button onClick={() => copy(exportText(app))}>전체 복사</button><button onClick={download}>.txt 다운로드</button></div>
      <small role="status">{feedback}</small>
    </div>
    {app.questions.map((q, index) => {
      const info = limitInfo(q);
      const state = q.done ? "완료" : q.answer ? "작성 중" : "작성 전";
      return <article key={q.id} className="answer-card" data-done={q.done}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) flush(); }}>
        <div className="application-heading"><h2>Q{index + 1}. {q.prompt}</h2><span className="question-state">{state}</span></div>
        <p className="question-meta">{q.required === "확인 필요" ? "필수 여부 확인 필요" : q.required} · {typeof q.limit === "number" ? q.limit + "자" : q.limit} · {q.basis === "확인 필요" ? "기준 확인 필요" : q.basis}</p>
        {q.details && editing !== q.id && <div className="form-requirements"><strong>문항별 세부 요구사항</strong><p>{q.details}</p></div>}
        {editing === q.id && <QuestionEditor initial={q} cancel={() => setEditing(null)} save={fields => {
          if (updateQuestion(q.id, latest => Object.assign(latest, fields))) setEditing(null);
        }} />}
        <textarea aria-label={`답변: ${takeChars(q.prompt, 32)}`} rows={5} placeholder="답변을 작성하세요" value={q.answer}
          onChange={e => answer(q.id, takeChars(e.target.value, maxAnswer))} />
        <div className="answer-count"><span>{info.both}</span>{typeof q.limit === "number" && <strong data-over={info.over}>
          {q.basis === "확인 필요" ? `${q.limit}자 · 기준 확인 필요` : info.detail}{info.over && " · 초과"}</strong>}</div>
        <div className="app-actions"><label className="done-check"><input type="checkbox" checked={q.done}
          aria-label={`완료: ${takeChars(q.prompt, 32)}`} onChange={e => {
            const done = e.target.checked; updateQuestion(q.id, latest => { latest.done = done; });
          }} /> 완료</label>
          <button onClick={() => copy(q.answer)}>이 답변 복사</button>
          <button onClick={() => setEditing(q.id)}>질문 수정</button>
          <button onClick={() => {
            if (q.answer && !window.confirm("이 질문을 삭제할까요? 작성한 답변도 삭제돼요.")) return;
            update(latest => { latest.questions = latest.questions.filter(item => item.id !== q.id).map((item, order) => ({ ...item, order })); });
          }}>질문 삭제</button></div>
      </article>;
    })}
    {editing === "new" ? <section className="answer-card"><h2>질문 추가</h2>
      <QuestionEditor initial={emptyFields} cancel={() => setEditing(null)} save={fields => {
        if (update(latest => {
          if (latest.questions.length >= maxQuestions) throw Error("질문은 30개까지예요.");
          latest.questions.push(newQuestion(fields, latest.questions.length));
        })) setEditing(null);
      }} /></section> : <button disabled={app.questions.length >= maxQuestions} onClick={() => setEditing("new")}>+ 질문 추가</button>}
  </>;
}
