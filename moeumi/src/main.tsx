import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { categories, rowSchema, type Row, type Draft } from "../shared/schemas";
import { Cover, editions, type Edition } from "./components/Cover";
import { Records } from "./components/Records";
import { Entry } from "./components/Entry";
import { daysLeft } from "./lib/dates";
import { commitSort, initializeOrder, moveRow, prependRow, readMode, sortKey, sortLabels, sortRows, type SortMode } from "./lib/sort";
import "./style.css";
const key = "campus_deadline_rows_v1";
const path =
  location.pathname.split("/")[1] || document.documentElement.dataset.edition;
const edition: Edition =
  path === "planner" || path === "library" ? path : "archive";
function read(): Row[] {
  return z
    .array(rowSchema)
    .parse(JSON.parse(localStorage.getItem(key) || "[]"));
}
function App() {
  const [initial] = useState(() => {
    try {
      return { rows: read(), mode: readMode(), error: "" };
    } catch {
      return {
        rows: [],
        mode: "deadline" as const,
        error: "저장 목록을 읽을 수 없어요. 브라우저 저장소를 확인해 주세요.",
      };
    }
  });
  const [rows, setRows] = useState(initial.rows),
    [sortMode, setSortMode] = useState<SortMode>(initial.mode),
    [error, setError] = useState(initial.error),
    [input, setInput] = useState(location.hash === "#new"),
    [cat, setCat] = useState("전체"),
    [date, setDate] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<{ mode: SortMode; rows: Row[] } | null>(null);
  const editing = draft !== null;
  const displayedMode = draft?.mode ?? sortMode;
  useEffect(() => {
    const hash = () => {
      if (editing && location.hash === "#new") history.replaceState(null, "", "#list");
      setInput(location.hash === "#new");
      window.scrollTo(0, 0);
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
  }, [editing]);
  function change(fn: (r: Row[]) => Row[]) {
    try {
      const next = fn(read());
      localStorage.setItem(key, JSON.stringify(next));
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
    setDate("");
    location.hash = "list";
    return true;
  }
  function selectSort(mode: SortMode) {
    setDraft(current => current && ({
      mode, rows: mode === "custom" ? initializeOrder(current.rows) : current.rows,
    }));
  }
  function startEdit() {
    if (cat !== "전체") return;
    setConfirm(false);
    setDraft({ mode: sortMode, rows: sortMode === "custom" ? initializeOrder(rows) : rows });
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
      commitSort(localStorage, key, rows, draft.rows, draft.mode);
      setRows(draft.rows);
      setSortMode(draft.mode);
      setDraft(null);
      setError("");
    } catch {
      setError("정렬 방식을 저장하지 못했어요. 브라우저 저장 권한을 확인해 주세요.");
    }
  }
  const visible = sortRows((draft?.rows ?? rows).filter(
      (r) =>
        (cat === "전체" || r.category === cat) && (editing || !date || r.endDate === date),
    ), displayedMode);
  const add = () => {
    location.hash = "new";
  };
  const scroll = () =>
    requestAnimationFrame(() =>
      document
        .getElementById("records")
        ?.scrollIntoView({ behavior: "smooth" }),
    );
  return (
    <div className={"app " + edition}>
      <header>
        <div className="top">
          <a className="brand" href="#list">
            <span className="logo" aria-hidden="true">
              m
            </span>
            모으미
          </a>
          <nav aria-label="화면">
            <a className={!input ? "active" : ""} href="#list">
              저장 목록
            </a>
            <a className={input ? "active" : ""} href={editing ? undefined : "#new"} aria-disabled={editing || undefined}>
              모집글 입력
            </a>
          </nav>
          <select
            aria-label="사이트 선택"
            disabled={editing}
            className="edition"
            value={edition}
            onChange={(e) => location.assign("/" + e.target.value)}
          >
            {Object.entries(editions).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </header>
      <main>
        {error && <p role="alert">{error}</p>}
        {input ? (
          <Entry save={save} />
        ) : (
          <>
            <fieldset disabled={editing} className="cover-controls">
            <Cover
              edition={edition}
              rows={rows}
              add={add}
              filter={(v) => {
                setCat(v);
                setDate("");
                scroll();
              }}
              date={(v) => {
                setDate(v);
                setCat("전체");
                scroll();
              }}
            />
            </fieldset>
            <div className="stats">
              {[
                ["전체 공고", rows.length],
                [
                  "7일 이내 마감",
                  rows.filter(
                    (r) => daysLeft(r.endDate) >= 0 && daysLeft(r.endDate) <= 7,
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
                {rows.length > 0 && (
                  <button disabled={editing} onClick={() => setConfirm(!confirm)}>
                    목록 비우기
                  </button>
                )}
              </div>
              {confirm && (
                <div className="actions">
                  공고 {rows.length}개를 모두 삭제할까요?
                  <button
                    onClick={() => {
                      if (change(() => [])) setConfirm(false);
                    }}
                  >
                    모두 삭제
                  </button>
                  <button onClick={() => setConfirm(false)}>취소</button>
                </div>
              )}
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
                {date && <button disabled={editing} onClick={() => setDate("")}>{date} ×</button>}
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
                  remove={(id) => change((r) => r.filter((x) => x.id !== id))}
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
                    <button
                      disabled={editing}
                      onClick={
                        rows.length
                          ? () => {
                              setCat("전체");
                              setDate("");
                            }
                          : add
                      }
                    >
                      {rows.length ? "전체 공고 보기" : "첫 공고 추가"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        모으미 <span>이 브라우저에 보관되는 나의 모집공고</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
