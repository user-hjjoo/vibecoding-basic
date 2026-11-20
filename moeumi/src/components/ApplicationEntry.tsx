import { useEffect, useRef, useState } from "react";
import type { Row } from "../../shared/schemas";
import { charCount, emptyFields, maxFormText, maxQuestions, splitResult, takeChars, type Fields } from "../../shared/forms";
import { editable, parseFields, QuestionFields, type Editable } from "./QuestionFields";

type Item = { id: string; draft: Editable };
function item(fields: Fields): Item { return { id: crypto.randomUUID(), draft: editable(fields) }; }

export function ApplicationEntry({ rows, close, save, saveError }: {
  rows: Row[]; close: () => void; saveError: string;
  save: (title: string, rowId: string | null, fields: Fields[], commonRequirements: string) => void;
}) {
  const [rowId, setRowId] = useState(""), [title, setTitle] = useState(""), [text, setText] = useState("");
  const [commonRequirements, setCommonRequirements] = useState("");
  const [review, setReview] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), request = useRef<AbortController | null>(null);
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => { request.current?.abort(); el.close(); };
  }, []);
  async function split() {
    if (request.current || !text.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/split-form", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]) });
      const data = await res.json();
      if (!res.ok) throw Error(data.message || "AI에 연결할 수 없어요.");
      const result = splitResult.parse(data);
      if (controller.signal.aborted) return;
      if (result.questions.length || result.commonRequirements.trim()) {
        setCommonRequirements(result.commonRequirements);
        setReview(result.questions.map(item));
      }
      else setError("질문을 찾지 못했어요. 원문을 고쳐 다시 시도하거나 직접 입력해 주세요.");
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error && err.name === "Error" ? err.message : "질문을 나누지 못했어요. 다시 시도하거나 직접 입력해 주세요.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function move(index: number, offset: number) {
    if (!review) return;
    const next = [...review];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setReview(next);
  }
  const fields = review?.map(q => parseFields(q.draft));
  return <dialog className="entry-dialog application-entry" ref={dialog} aria-labelledby="application-entry-title"
    onCancel={e => { e.preventDefault(); close(); }}>
    <div className="sectionTitle"><h2 id="application-entry-title">{review ? "지원서 질문 검수" : "지원서 추가"}</h2><button onClick={close}>닫기</button></div>
    <label>연결할 공고<select value={rowId} onChange={e => {
      const id = e.target.value;
      setRowId(id);
      if (id) setTitle(rows.find(r => r.id === id)?.title ?? "");
    }}><option value="">연결 안 함</option>{rows.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
    <label>지원서 제목<input value={title} onChange={e => setTitle(e.target.value)} /></label>
    {review === null ? <>
      <label>지원서 폼 텍스트<textarea rows={7} disabled={busy} value={text}
        onChange={e => setText(takeChars(e.target.value, maxFormText))} /></label>
      <small>{charCount(text).toLocaleString("ko-KR")} / 10,000자</small>
      <p className="form-notice">AI로 나누면 붙여넣은 질문 텍스트가 Google Gemini로 전송돼요. 이름·연락처 같은 개인정보는 지우고 붙여넣어 주세요. 내가 쓴 답변은 AI로 보내지 않아요.</p>
      <div className="app-actions"><button className="primary" onClick={split} disabled={busy || !text.trim()}>{busy ? "질문을 나누는 중…" : "AI로 나누기"}</button>
        <button disabled={busy} onClick={() => { setReview([item(emptyFields)]); setError(""); }}>질문 직접 입력</button></div>
    </> : <>
      <label>공통 요구사항<textarea rows={2} value={commonRequirements} onChange={e => setCommonRequirements(e.target.value)} /></label>
      {!review.length && <p>저장하려면 질문을 한 개 이상 추가해 주세요.</p>}
      {review.map((q, i) => <fieldset key={q.id} className="review-question"><legend>질문 {i + 1}</legend>
        <QuestionFields value={q.draft} change={draft => setReview(review.map(x => x.id === q.id ? { ...x, draft } : x))} />
        <div className="app-actions"><button disabled={i === 0} onClick={() => move(i, -1)}>위로</button>
          <button disabled={i === review.length - 1} onClick={() => move(i, 1)}>아래로</button>
          <button onClick={() => setReview(review.filter(x => x.id !== q.id))}>질문 삭제</button></div>
      </fieldset>)}
      <div className="app-actions"><button disabled={review.length >= maxQuestions} onClick={() => setReview([...review, item(emptyFields)])}>+ 질문 추가</button>
        <button className="primary" disabled={!title.trim() || !fields?.length || fields.some(q => !q)}
          onClick={() => { if (fields?.every((q): q is Fields => q !== null)) save(title, rowId || null, fields, commonRequirements.trim()); }}>저장</button></div>
    </>}
    {(error || saveError) && <p role="alert">{error || saveError}</p>}
  </dialog>;
}
