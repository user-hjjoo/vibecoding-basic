import React, { Fragment, useState } from "react";
import { type Row, type Draft } from "../../shared/schemas";
import { daysLeft, deadlineLabel } from "../lib/dates";
import { Fields } from "./Entry";
import type { SortMode } from "../lib/sort";
export function Records({
  rows,
  mode,
  editing,
  move,
  setApplied,
  update,
  deleteIds,
  selectDelete,
}: {
  rows: Row[];
  mode: SortMode;
  editing: boolean;
  move?: (id: string, targetId: string) => void;
  setApplied: (id: string, applied: boolean) => void;
  update: (r: Row) => boolean;
  deleteIds?: ReadonlySet<string>;
  selectDelete: (id: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(""),
    [edit, setEdit] = useState(""),
    [v, setV] = useState<Draft>();
  const [showExpired, setShowExpired] = useState(false);
  const expanded = editing || showExpired;
  const [dropTarget, setDropTarget] = useState("");
  function targetAt(e: React.PointerEvent<HTMLButtonElement>, source: Row) {
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const tr = element?.closest<HTMLTableRowElement>("tr[data-row-id]");
    if (tr?.closest("table") !== e.currentTarget.closest("table")) return "";
    const target = rows.find(row => row.id === tr?.dataset.rowId);
    if (!target || target.id === source.id) return "";
    return (daysLeft(target.endDate) < 0) === (daysLeft(source.endDate) < 0) ? target.id : "";
  }
  const firstExpired = rows.findIndex((row) => daysLeft(row.endDate) < 0);
  const split = firstExpired < 0 ? rows.length : firstExpired;
  const period = (a: string, b: string) => (b ? a + " ~ " + b : a);
  const start = (r: Row) => {
    setV({ ...r });
    setEdit(r.id);
    setOpen(r.id);
  };
  return (
    <table className={move ? "reorderable" : undefined}>
      <thead>
        <tr>
          {[
            "지원 완료",
            "카테고리",
            "활동명",
            "주관사",
            "마감일",
            "활동·행사 기간",
            "참여방식",
            editing ? "삭제" : "관리",
          ].map((x) => (
            <th key={x}>{x}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, split).map(renderRow)}
        {firstExpired >= 0 && (
          <tr className="separator">
            <td colSpan={8}>
              <button type="button" disabled={editing} aria-expanded={expanded}
                onClick={() => setShowExpired((shown) => !shown)}>
                <span aria-hidden="true">{expanded ? "▾" : "▸"} </span>
                마감 지난 공고 ({rows.length - firstExpired}건)
              </button>
            </td>
          </tr>
        )}
        {expanded && rows.slice(split).map((row, i) => renderRow(row, split + i))}
      </tbody>
    </table>
  );

  function renderRow(r: Row, i: number) {
    const previous = i > 0 && i !== split ? rows[i - 1] : undefined;
    const next = i + 1 !== split ? rows[i + 1] : undefined;
    const remaining = daysLeft(r.endDate);
    const label = r.isExample && remaining >= 0 ? "" : deadlineLabel(r.endDate);
    const countdownClass = remaining >= 0
      ? (remaining <= 7 ? "countdown urgent" : "countdown")
      : undefined;
    return (
      <Fragment key={r.id}>
        {mode === "deadline" && isNaN(remaining) &&
          (i === 0 || !isNaN(daysLeft(rows[i - 1].endDate))) && (
            <tr className="separator">
              <td colSpan={8}>마감일 미확정 · 상시 공고</td>
            </tr>
          )}
        <tr
          className={r.applied ? "record applied" : "record"}
          data-row-id={r.id}
          data-drop-target={move && dropTarget === r.id ? "true" : undefined}
          onClick={editing ? undefined : () => setOpen(open === r.id ? "" : r.id)}
        >
          <td className="applied-cell" onClick={(e) => e.stopPropagation()}>
            {move && (
              <button type="button" className="drag-handle"
                aria-label={`순서 변경: ${r.title}`}
                title="끌어서 이동하거나 위·아래 방향키로 순서를 바꾸세요"
                onPointerDown={e => {
                  if (!e.isPrimary || e.button !== 0) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={e => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    setDropTarget(targetAt(e, r));
                }}
                onPointerUp={e => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const target = targetAt(e, r);
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  if (target) move(r.id, target);
                }}
                onLostPointerCapture={() => setDropTarget("")}
                onKeyDown={e => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  const target = e.key === "ArrowUp" ? previous : next;
                  if (target) move(r.id, target.id);
                }}
              >⋮⋮</button>
            )}
            <label>
              <input type="checkbox" checked={r.applied} disabled={editing}
                aria-label={`지원 완료: ${r.title}`}
                onChange={(e) => setApplied(r.id, e.currentTarget.checked)}
              />
              <span>지원 완료</span>
            </label>
          </td>
          <td>
            <span className="category-tag" data-category={r.category}>{r.category}</span>
          </td>
          <td>
            <button disabled={editing} aria-expanded={open === r.id} className="name">
              {r.title}
            </button>
            {r.isExample && <span className="example-badge">예시</span>}
          </td>
          {[
            r.organizer,
            r.endDate,
            period(r.activityStartDate, r.activityEndDate),
            r.participationMethod,
          ].map((x, j) => (
            <td key={j}>
              {j === 1 && label && (
                <><em className={countdownClass}>{label}</em>{" "}</>
              )}
              {x}
            </td>
          ))}
          <td data-label={editing ? "삭제" : "관리"} onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <input type="checkbox" checked={deleteIds?.has(r.id) ?? false}
                aria-label={`삭제 선택: ${r.title}`}
                onChange={e => selectDelete(r.id, e.currentTarget.checked)} />
            ) : <button onClick={() => start(r)}>수정</button>}
          </td>
        </tr>
        {open === r.id && (
          <tr className="detail">
            <td colSpan={8}>
              {edit === r.id && v ? (
                <>
                  <Fields value={v} onChange={setV} />
                  <div className="actions">
                    <button
                      disabled={!v.title.trim()}
                      onClick={() => {
                        if (update({ ...r, ...v })) setEdit("");
                      }}
                    >
                      수정 저장
                    </button>
                    <button onClick={() => setEdit("")}>취소</button>
                  </div>
                </>
              ) : (
                <div className="details">
                  <p>
                    <b>핵심 내용</b>
                    {r.summary}
                  </p>
                  <p>
                    <b>기타 일정</b>
                    {r.otherSchedule}
                  </p>
                  <p>
                    <b>출처</b>
                    {/^https?:\/\//i.test(r.source) ? (
                      <a href={r.source} target="_blank" rel="noreferrer">
                        {r.source}
                      </a>
                    ) : (
                      r.source || "출처 미입력"
                    )}{" "}
                    <button onClick={() => start(r)}>수정</button>
                  </p>
                </div>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }
}
