import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { initializeArchive, readRows, rowsKey as key } from "./lib/archive";
import { categories, rowSchema, type Row, type Draft } from "../shared/schemas";
import { Cover } from "./components/Cover";
import { Records } from "./components/Records";
import { Entry } from "./components/Entry";
import { Applications } from "./components/Applications";
import { Notepad } from "./components/Notepad";
import { writeArchiveRows } from "./lib/notes";
import { daysLeft } from "./lib/dates";
import { commitListEdit, initializeOrder, moveRow, prependRow, readMode, sortKey, sortLabels, sortRows, type SortMode } from "./lib/sort";
import "./style.css";
if (/^\/(planner|library)\/?$/.test(location.pathname)) {
  history.replaceState(null, "", "/archive" + location.search + location.hash);
}
const read = () => readRows(localStorage);
function loadArchive() {
  try {
    const mode = readMode();
    return { rows: initializeArchive(localStorage), mode, error: "" };
  } catch {
    return {
      rows: [],
      mode: "deadline" as const,
      error: "저장 목록을 읽을 수 없어요. 브라우저 저장소를 확인해 주세요.",
    };
  }
}
const initial = loadArchive();
function currentScreen() {
  return location.hash === "#notes" ? "notes" : location.hash === "#applications" ? "applications" : "records";
}
function App() {
  const addButton = useRef<HTMLButtonElement>(null);
  const beforeLeave = useRef<(() => boolean) | null>(null);
  const [screen, setScreen] = useState(currentScreen);
  const recordsOpen = screen === "records";
  const [rows, setRows] = useState(initial.rows),
    [sortMode, setSortMode] = useState<SortMode>(initial.mode),
    [error, setError] = useState(initial.error),
    [input, setInput] = useState(location.hash === "#new"),
    [cat, setCat] = useState("전체");
  const [draft, setDraft] = useState<{ mode: SortMode; rows: Row[]; deleteIds: Set<string> } | null>(null);
  const editing = draft !== null;
  const displayedMode = draft?.mode ?? sortMode;
  useEffect(() => {
    const hash = () => {
      if (editing && (location.hash === "#new" || currentScreen() !== "records")) {
        history.replaceState(null, "", "#list");
      }
      const next = currentScreen();
      if (screen !== next && beforeLeave.current?.() === false) {
        history.replaceState(null, "", "#" + screen);
        return;
      }
      setScreen(next);
      setInput(location.hash === "#new");
      if (next !== "records" || location.hash === "#list") window.scrollTo(0, 0);
    };
    const sync = (e: StorageEvent) => {
      if (e.key === key || e.key === sortKey || !e.key) {
        try {
          setRows(read());
          setSortMode(readMode());
          setDraft(null);
          setError(editing ? "다른 탭에서 목록이 변경되어 편집을 종료했어요. 최신 목록에서 다시 편집해 주세요." : "");
        } catch {
          setError("저장 목록을 읽을 수 없어요.");
        }
      }
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("storage", sync);
    };
  }, [editing, screen]);
  function change(fn: (r: Row[]) => Row[]) {
    try {
      const previous = read();
      const next = fn(previous);
      writeArchiveRows(localStorage, previous, next);
      setRows(next);
      setError("");
      return true;
    } catch {
      setError(
        "저장하지 못했어요. 브라우저 저장 권한과 남은 공간을 확인해 주세요.",
      );
      return false;
    }
  }
  function save(v: Draft) {
    const values = { ...v };
    for (const k of [
      "startDate",
      "endDate",
      "activityStartDate",
      "organizer",
      "summary",
      "otherSchedule",
      "participationMethod",
    ] as const)
      values[k] = v[k].trim() || "확인 필요";
    if (
      !change((r) => prependRow(r,
        { ...values, id: crypto.randomUUID(), createdAt: Date.now(), applied: false },
        readMode()
      ))
    )
      return false;
    setCat("전체");
    closeInput();
    return true;
  }
  function selectSort(mode: SortMode) {
    setDraft(current => current && ({
      ...current, mode, rows: mode === "custom" ? initializeOrder(current.rows) : current.rows,
    }));
  }
  function startEdit() {
    if (cat !== "전체") return;
    setDraft({ deleteIds: new Set(), mode: sortMode, rows: sortMode === "custom" ? initializeOrder(rows) : rows });
  }
  function selectDelete(id: string, checked: boolean) {
    setDraft(current => {
      if (!current) return current;
      const deleteIds = new Set(current.deleteIds);
      if (checked) deleteIds.add(id);
      else deleteIds.delete(id);
      return { ...current, deleteIds };
    });
  }
  function applyEdit() {
    if (!draft) return;
    try {
      const latest = read();
      if (JSON.stringify(latest) !== JSON.stringify(rowSchema.array().parse(rows)) || readMode() !== sortMode) {
        setRows(latest);
        setSortMode(readMode());
        setDraft(null);
        setError("다른 탭에서 목록이 변경됐어요. 최신 목록에서 다시 편집해 주세요.");
        return;
      }
      const next = draft.rows.filter(row => !draft.deleteIds.has(row.id));
      commitListEdit(localStorage, rows, next, draft.mode);
      setRows(next);
      setSortMode(draft.mode);
      setDraft(null);
      setError("");
    } catch {
      setError("편집 내용을 저장하지 못했어요. 브라우저 저장 권한을 확인해 주세요.");
    }
  }
  const visible = sortRows((draft?.rows ?? rows).filter(
    row => cat === "전체" || row.category === cat,
  ), displayedMode);
  function closeInput() {
    setInput(false);
    if (location.hash === "#new") history.replaceState(null, "", "#list");
    requestAnimationFrame(() => addButton.current?.focus());
  }
  return (
    <div className="app archive">
      <header>
        <div className="top">
          <a className="brand" href="#list">
            <span className="logo" aria-hidden="true">
              m
            </span>
            모으미
          </a>
          <nav aria-label="화면">
            {([["records", "저장 목록"], ["notes", "메모장"], ["applications", "지원서 매니저"]] as const).map(([id, label]) =>
              <a key={id} className={screen === id ? "active" : undefined} aria-current={screen === id ? "page" : undefined}
                aria-disabled={editing || undefined} href={editing ? undefined : "#" + id}>{label}</a>
            )}
          </nav>
          {recordsOpen && <button className="primary add-notice" ref={addButton} disabled={editing}
            aria-haspopup="dialog" onClick={() => setInput(true)}>+ 모집공고 추가</button>}
        </div>
      </header>
      <main>
        {screen === "notes" && <Notepad rows={rows} beforeLeave={beforeLeave} />}
        {screen === "applications" && <Applications rows={rows} beforeLeave={beforeLeave} />}
        <div hidden={!recordsOpen}>
        {error && !input && <p role="alert">{error}</p>}
        {input && !editing && <Entry save={save} close={closeInput} />}
        <Cover />
        <div className="stats">
          {[
            ["전체 공고", rows.length],
            [
              "7일 이내 마감",
              rows.filter(
                (r) => !r.isExample && daysLeft(r.endDate) >= 0 && daysLeft(r.endDate) <= 7,
              ).length,
            ],
            [
              "미확정 · 상시",
              rows.filter((r) => isNaN(daysLeft(r.endDate))).length,
            ],
          ].map(([k, v], i) => (
            <div key={k}>
              <i aria-hidden="true">{["▤", "◷", "◌"][i]}</i>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <section id="records">
          <div className="sectionTitle">
            <h2>
              저장 목록 <small>{visible.length}</small>
            </h2>
            {draft && rows.length > 0 && (
              <button onClick={() => setDraft({
                ...draft, deleteIds: draft.deleteIds.size === rows.length
                  ? new Set() : new Set(rows.map(row => row.id)),
              })}>
                {draft.deleteIds.size === rows.length ? "전체 삭제 선택 해제" : "전체 삭제 선택"}
              </button>
            )}
          </div>
          <div className="filters">
            {["전체", ...categories].map((c) => (
              <button
                key={c}
                data-category={c === "전체" ? undefined : c}
                aria-pressed={cat === c}
                disabled={editing}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="sort-controls">
            {draft ? <>
              <label>정렬 방식
              <select value={draft.mode} onChange={e => selectSort(e.target.value as SortMode)}>
                {Object.entries(sortLabels).map(([mode, label]) =>
                  <option key={mode} value={mode}>{label}</option>
                )}
              </select>
            </label>
              <small role="status">{draft.deleteIds.size > 0 && `삭제 예정 ${draft.deleteIds.size}건`}</small>
              <button className="primary" onClick={applyEdit}>적용</button>
              <button onClick={() => { setDraft(null); setError(""); }}>취소</button>
            </> : <>
              <small>{sortLabels[sortMode]}</small>
              <button disabled={cat !== "전체"} onClick={startEdit}>편집</button>
              {cat !== "전체" && <span>편집은 전체 탭에서 할 수 있어요</span>}
            </>}
          </div>
          <div className="paper">
            <Records
              key={editing ? "editing" : "view"}
              editing={editing}
              rows={visible}
              mode={displayedMode}
              move={draft?.mode === "custom"
                ? (id, target) => setDraft(current => current && ({
                    ...current, rows: moveRow(current.rows, id, target),
                  }))
                : undefined}
              setApplied={(id, applied) =>
                change((rows) => rows.map((row) =>
                  row.id === id ? { ...row, applied } : row
                ))
              }
              update={(v) =>
                change((r) => r.map((x) =>
                  x.id === v.id ? { ...v, applied: x.applied, customOrder: x.customOrder } : x
                ))
              }
              deleteIds={draft?.deleteIds}
              selectDelete={selectDelete}
            />
            {!visible.length && (
              <div className="empty">
                <span className="tray" aria-hidden="true">
                  ▱
                </span>
                <h3>
                  {rows.length
                    ? "조건에 맞는 공고가 없어요"
                    : "아직 저장한 공고가 없어요"}
                </h3>
                <p>
                  {rows.length
                    ? "다른 분류의 공고도 살펴보세요."
                    : "모집글이나 포스터로 첫 공고를 추가해 보세요."}
                </p>
                {rows.length > 0 && (
                  <button disabled={editing} onClick={() => setCat("전체")}>전체 공고 보기</button>
                )}
              </div>
            )}
          </div>
        </section>
        </div>
      </main>
      <footer>
        모으미 {recordsOpen && <span>이 브라우저에 보관되는 나의 모집공고</span>}
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
