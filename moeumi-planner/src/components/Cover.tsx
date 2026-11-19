import React, { useState } from "react";
import { categories, type Row } from "../../shared/schemas";
import { today } from "../lib/dates";
export const editions = {
  archive: "공고 아카이브",
  planner: "마감 플래너",
  library: "분류 서가",
};
export type Edition = keyof typeof editions;
function Calendar({
  rows,
  choose,
}: {
  rows: Row[];
  choose: (v: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const d = new Date(today());
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  const prefix = d.toISOString().slice(0, 7);
  const count = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return (
    <div className="calendar">
      <div className="month">
        <button aria-label="이전 달" onClick={() => setOffset(offset - 1)}>
          ‹
        </button>
        <b>
          {d.getUTCFullYear()}년 {d.getUTCMonth() + 1}월
        </b>
        <button aria-label="다음 달" onClick={() => setOffset(offset + 1)}>
          ›
        </button>
      </div>
      <div className="grid7">
        {Array.from("일월화수목금토").map((v) => (
          <small key={v}>{v}</small>
        ))}
        {Array.from({ length: d.getUTCDay() }, (_, i) => (
          <span key={"s" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const iso = prefix + "-" + String(i + 1).padStart(2, "0");
          const has = rows.some((r) => r.endDate === iso);
          return (
            <button
              key={iso}
              disabled={!has}
              title={iso}
              className={has ? "marked" : ""}
              onClick={() => choose(iso)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function FolderArt() {
  return (
    <div className="art" aria-hidden="true">
      <div className="sheet sheet1" />
      <div className="sheet sheet2">
        <i />
        <i />
        <i />
      </div>
      <div className="folder">
        <div className="sticker">
          M<span>•</span>
        </div>
        <div className="lines">|||| ||| | |||| ||</div>
      </div>
      <div className="clip" />
    </div>
  );
}
export function Cover({
  edition,
  rows,
  add,
  filter,
  date,
}: {
  edition: Edition;
  rows: Row[];
  add: () => void;
  filter: (c: string) => void;
  date: (d: string) => void;
}) {
  return (
    <section className="cover">
      <div className="coverText">
        <small className="kicker">
          {
            {
              archive: "PERSONAL ARCHIVE",
              planner: "DEADLINE PLANNER",
              library: "CATEGORY LIBRARY",
            }[edition]
          }
        </small>
        <h1>{editions[edition]}</h1>
        <p>
          {
            {
              archive:
                "관심 있는 모집공고를 모으고, 마감일을 한눈에 확인하세요.",
              planner: "달력에서 마감일을 선택해 지원할 공고를 확인하세요.",
              library: "관심 분야를 선택해 보관한 공고를 찾아보세요.",
            }[edition]
          }
        </p>
        <button className="primary" onClick={add}>
          ＋ 모집공고 추가
        </button>
      </div>
      {edition === "archive" ? (
        <FolderArt />
      ) : edition === "planner" ? (
        <Calendar rows={rows} choose={date} />
      ) : (
        <div className="shelves">
          {categories.map((c, i) => (
            <button key={c} onClick={() => filter(c)}>
              <span>{["✳", "⌘", "◉", "◇", "▣", "✦"][i]}</span>
              {c}
              <b>{rows.filter((r) => r.category === c).length}</b>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
