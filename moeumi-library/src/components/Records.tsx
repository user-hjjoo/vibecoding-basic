import React, { Fragment, useState } from "react";
import { type Row, type Draft } from "../../shared/schemas";
import { daysLeft, deadlineLabel } from "../lib/dates";
import { Fields } from "./Entry";
export function Records({
  rows,
  update,
  remove,
}: {
  rows: Row[];
  update: (r: Row) => boolean;
  remove: (id: string) => void;
}) {
  const [open, setOpen] = useState(""),
    [edit, setEdit] = useState(""),
    [v, setV] = useState<Draft>();
  const period = (a: string, b: string) => (b ? a + " ~ " + b : a);
  const start = (r: Row) => {
    setV({ ...r });
    setEdit(r.id);
    setOpen(r.id);
  };
  return (
    <table>
      <thead>
        <tr>
          {[
            "활동명",
            "카테고리",
            "주관사",
            "모집 기간",
            "활동·행사 기간",
            "참여 방식",
            "관리",
          ].map((x) => (
            <th key={x}>{x}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <Fragment key={r.id}>
            {isNaN(daysLeft(r.endDate)) &&
              (i === 0 || !isNaN(daysLeft(rows[i - 1].endDate))) && (
                <tr className="separator">
                  <td colSpan={7}>마감일 미확정 · 상시 공고</td>
                </tr>
              )}
            <tr
              className="record"
              onClick={() => setOpen(open === r.id ? "" : r.id)}
            >
              <td>
                <button aria-expanded={open === r.id} className="name">
                  {r.title}
                </button>
              </td>
              {[
                r.category,
                r.organizer,
                period(r.startDate, r.endDate),
                period(r.activityStartDate, r.activityEndDate),
                r.participationMethod,
              ].map((x, j) => (
                <td key={j}>
                  {j === 2 && deadlineLabel(r.endDate) && (
                    <em>{deadlineLabel(r.endDate)} </em>
                  )}
                  {x}
                </td>
              ))}
              <td onClick={(e) => e.stopPropagation()}>
                <button onClick={() => start(r)}>수정</button>{" "}
                <button onClick={() => remove(r.id)}>삭제</button>
              </td>
            </tr>
            {open === r.id && (
              <tr className="detail">
                <td colSpan={7}>
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
        ))}
      </tbody>
    </table>
  );
}
