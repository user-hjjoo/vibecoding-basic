import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { categories, rowSchema, type Row, type Draft } from "../shared/schemas";
import { Cover, editions, type Edition } from "./components/Cover";
import { Records } from "./components/Records";
import { Entry } from "./components/Entry";
import { compare, daysLeft } from "./lib/dates";
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
      return { rows: read(), error: "" };
    } catch {
      return {
        rows: [],
        error: "저장 목록을 읽을 수 없어요. 브라우저 저장소를 확인해 주세요.",
      };
    }
  });
  const [rows, setRows] = useState(initial.rows),
    [error, setError] = useState(initial.error),
    [input, setInput] = useState(location.hash === "#new"),
    [cat, setCat] = useState("전체"),
    [date, setDate] = useState(""),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const hash = () => {
      setInput(location.hash === "#new");
      window.scrollTo(0, 0);
    };
    const sync = (e: StorageEvent) => {
      if (e.key === key || !e.key) {
        try {
          setRows(read());
          setError("");
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
  }, []);
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
      !change((r) => [
        ...r,
        { ...values, id: crypto.randomUUID(), createdAt: Date.now() },
      ])
    )
      return false;
    setCat("전체");
    setDate("");
    location.hash = "list";
    return true;
  }
  const visible = rows
    .filter(
      (r) =>
        (cat === "전체" || r.category === cat) && (!date || r.endDate === date),
    )
    .sort(compare);
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
            <a className={input ? "active" : ""} href="#new">
              모집글 입력
            </a>
          </nav>
          <select
            aria-label="사이트 선택"
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
                  <button onClick={() => setConfirm(!confirm)}>
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
                    aria-pressed={cat === c}
                    onClick={() => setCat(c)}
                  >
                    {c}
                  </button>
                ))}
                {date && <button onClick={() => setDate("")}>{date} ×</button>}
              </div>
              <div className="paper">
                <Records
                  rows={visible}
                  update={(v) =>
                    change((r) => r.map((x) => (x.id === v.id ? v : x)))
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
