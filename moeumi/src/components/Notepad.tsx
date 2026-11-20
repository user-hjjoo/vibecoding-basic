import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Row } from "../../shared/schemas";
import { readRows } from "../lib/archive";
import { appendNote, colors, editTime, noteLimit, notesKey, readNotebook, textLimit, type Notebook } from "../lib/notes";

const colorNames = { yellow: "노랑", pink: "분홍", blue: "파랑", green: "초록" };
type Props = {
  rows: Row[];
  beforeLeave: React.RefObject<(() => boolean) | null>;
};

export function Notepad({ rows, beforeLeave }: Props) {
  const [book, setBook] = useState<Notebook | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const pending = useRef(drafts);
  const composing = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const addButton = useRef<HTMLButtonElement>(null);
  const editorToFocus = useRef<HTMLTextAreaElement>(null);

  const commit = useCallback((change?: (latest: Notebook, time: number) => void) => {
    clearTimeout(timer.current);
    if (!change && !Object.keys(pending.current).length) return true;
    try {
      const latest = readNotebook(localStorage);
      const time = editTime(latest);
      for (const note of latest.notes) {
        const content = pending.current[note.id];
        if (content !== undefined && content !== note.content) {
          note.content = content;
          note.updatedAt = time;
        }
      }
      change?.(latest, time);
      localStorage.setItem(notesKey, JSON.stringify(latest));
      pending.current = {};
      setDrafts(pending.current);
      setBook(latest);
      setError("");
      return true;
    } catch (err) {
      setError(err instanceof Error && err.message === "메모는 100장까지예요"
        ? err.message : "메모를 저장하지 못했어요. 브라우저 저장 권한과 남은 공간을 확인해 주세요.");
      return false;
    }
  }, []);

  useEffect(() => {
    function refresh() {
      try {
        setBook(readNotebook(localStorage));
        setError("");
      } catch {
        setBook(null);
        setError("메모를 읽을 수 없어요. 브라우저 저장소를 확인해 주세요.");
      }
    }
    refresh();
    const sync = (event: StorageEvent) => {
      if (event.key === notesKey || event.key === null) refresh();
    };
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
  }, [beforeLeave, commit]);

  useEffect(() => {
    if (focusId) {
      editorToFocus.current?.focus();
      setFocusId(null);
    }
  }, [focusId]);

  function scheduleSave() {
    clearTimeout(timer.current);
    if (!composing.current) timer.current = setTimeout(() => commit(), 500);
  }

  function add() {
    let id = "";
    if (commit(latest => { id = appendNote(latest).id; })) {
      if (filter !== "unlinked") setFilter("all");
      setSearch("");
      setFocusId(id);
    }
  }

  function remove(id: string) {
    if (commit(latest => { latest.notes = latest.notes.filter(note => note.id !== id); })) {
      setConfirmId(null);
      requestAnimationFrame(() => addButton.current?.focus());
    }
  }

  const titles = new Map(rows.map(row => [row.id, row.title]));
  const activeFilter = filter === "unlinked" || titles.has(filter) ? filter : "all";
  const keyword = search.toLocaleLowerCase();
  const visible = (book?.notes ?? []).filter(note =>
    (activeFilter === "all" || (activeFilter === "unlinked" ? note.rowId === null : note.rowId === activeFilter))
    && (composing.current === note.id || (drafts[note.id] ?? note.content).toLocaleLowerCase().includes(keyword))
  ).sort((a, b) => b.updatedAt - a.updatedAt);
  const full = (book?.notes.length ?? 0) >= noteLimit;

  return <section className="notepad" aria-labelledby="notes-title">
    <div className="sectionTitle">
      <h1 id="notes-title">메모장</h1>
      <button className="primary" ref={addButton} disabled={!book || full} onClick={add}>+ 메모 추가</button>
    </div>
    <small>메모는 이 브라우저에만 저장돼요</small>
    {full && <p role="status">메모는 100장까지예요</p>}
    {error && <p role="alert">{error}</p>}
    <div className="note-filters">
      <label>공고 필터
        <select value={activeFilter} onChange={event => setFilter(event.target.value)}>
          <option value="all">전체</option><option value="unlinked">연결 안 됨</option>
          {rows.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
        </select>
      </label>
      <label>메모 검색<input type="search" placeholder="메모 내용 검색" value={search}
        onChange={event => setSearch(event.target.value)} /></label>
    </div>
    {book && !visible.length && <p>{book.notes.length ? "조건에 맞는 메모가 없어요." : "아직 작성한 메모가 없어요."}</p>}
    <div className="note-grid">
      {visible.map(note => {
        const content = drafts[note.id] ?? note.content;
        const linkedTitle = note.rowId === null ? undefined : titles.get(note.rowId);
        return <article key={note.id} className="note-card" data-color={note.color}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) commit(); }}>
          <div className="note-toolbar">
            <div className="note-colors" role="group" aria-label="메모 색">
              {colors.map(color => <button key={color} className="note-swatch" data-color={color}
                aria-label={colorNames[color]} title={colorNames[color]} aria-pressed={note.color === color}
                onClick={() => commit((latest, time) => {
                  const current = latest.notes.find(item => item.id === note.id);
                  if (current && current.color !== color) { current.color = color; current.updatedAt = time; }
                })} />)}
            </div>
            <button className="note-delete" onClick={() => content.length ? setConfirmId(note.id) : remove(note.id)}>삭제</button>
          </div>
          <textarea ref={note.id === focusId ? editorToFocus : undefined} aria-label="메모"
            maxLength={textLimit} value={content}
            onCompositionStart={() => { composing.current = note.id; clearTimeout(timer.current); }}
            onCompositionEnd={() => { composing.current = null; scheduleSave(); }}
            onChange={event => {
              pending.current = { ...pending.current, [note.id]: event.target.value.slice(0, textLimit) };
              setDrafts(pending.current);
              scheduleSave();
            }} />
          <small className="note-count">{content.length} / {textLimit}자</small>
          <label className="note-link">연결할 공고
            <select value={note.rowId ?? ""} onChange={event => {
              const id = event.target.value;
              commit((latest, time) => {
                const current = latest.notes.find(item => item.id === note.id);
                if (!current) return;
                const exists = id && readRows(localStorage).some(row => row.id === id);
                current.rowId = exists ? id : null;
                current.deletedTitle = id && !exists ? titles.get(id) : undefined;
                current.updatedAt = time;
              });
            }}>
              <option value="">연결 안 함</option>
              {rows.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
            </select>
          </label>
          {linkedTitle && <small className="note-tag">{linkedTitle}</small>}
          {note.deletedTitle && <small className="note-former">(삭제된 공고) {note.deletedTitle}</small>}
          {confirmId === note.id && <div className="note-confirm" role="group" aria-label="이 메모를 삭제할까요?">
            <p>이 메모를 삭제할까요?</p>
            <button onClick={() => remove(note.id)}>삭제 확인</button>{" "}
            <button autoFocus onClick={event => {
              event.currentTarget.closest("article")?.querySelector<HTMLButtonElement>(".note-delete")?.focus();
              setConfirmId(null);
            }}>취소</button>
          </div>}
        </article>;
      })}
    </div>
  </section>;
}
