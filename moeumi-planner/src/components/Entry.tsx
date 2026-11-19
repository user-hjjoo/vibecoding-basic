import React, { useRef, useState } from "react";
import {
  blank,
  categories,
  draftSchema,
  labels,
  type Draft,
} from "../../shared/schemas";
import { prepareImage } from "../lib/image";
export function Fields({
  value,
  onChange,
}: {
  value: Draft;
  onChange: (v: Draft) => void;
}) {
  return (
    <div className="fields">
      {(Object.keys(labels) as (keyof Draft)[]).map((k) => (
        <label key={k}>
          {labels[k]}
          {k === "category" ? (
            <select
              value={value.category}
              onChange={(e) =>
                onChange({
                  ...value,
                  category: e.target.value as Draft["category"],
                })
              }
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              value={value[k]}
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );
}
export function Entry({ save }: { save: (v: Draft) => boolean }) {
  const [text, setText] = useState(""),
    [source, setSource] = useState(""),
    [file, setFile] = useState<File>(),
    [draft, setDraft] = useState<Draft>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null),
    lock = useRef(false),
    review = useRef<HTMLElement>(null);
  function show(value: Draft) {
    setDraft(value);
    requestAnimationFrame(() =>
      review.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }
  async function run() {
    if (lock.current) return;
    setError("");
    if (!text.trim() && !file) {
      setError("모집글이나 포스터를 입력해 주세요.");
      ref.current?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const body = JSON.stringify({
        text,
        image: file ? await prepareImage(file) : undefined,
      });
      if (new Blob([body]).size > 4000000)
        throw Error("이미지를 잘라 다시 첨부해 주세요.");
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(50000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw Error(
          data.message ||
            (res.status === 413
              ? "이미지를 줄여 주세요."
              : "서버 연결을 확인해 주세요."),
        );
      show({ ...draftSchema.parse(data), source });
    } catch (e) {
      setError(
        e instanceof Error && e.name === "Error"
          ? e.message
          : "정리할 수 없어요. 연결과 입력을 확인하고 다시 시도해 주세요.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="sectionTitle">
        <h1>모집글 입력</h1>
      </div>
      <section className="paper form">
        <fieldset disabled={busy}>
          <div className="formHead">
            <label htmlFor="notice">모집글 본문</label>
            <button
              onClick={() => {
                setText(
                  "캠퍼스 디자인 공모전\n주관: 대학생 디자인 연합\n모집: 2026-11-01 ~ 2026-11-30\n활동: 2026-12-12 온라인 발표",
                );
                setDraft(undefined);
              }}
            >
              예시 채우기
            </button>
          </div>
          <textarea
            id="notice"
            ref={ref}
            value={text}
            maxLength={20000}
            placeholder="모집공고 내용을 여기에 붙여 넣으세요."
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void run();
              }
            }}
          />
          <small>{text.length.toLocaleString()} / 20,000자</small>
          <div className="fields">
            <label>
              포스터 첨부 · JPG, PNG (10MB)
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (
                    f &&
                    (!["image/jpeg", "image/png"].includes(f.type) ||
                      f.size > 10 * 1024 * 1024)
                  ) {
                    setError("10MB 이하의 JPG 또는 PNG를 선택해 주세요.");
                    e.target.value = "";
                    setFile(undefined);
                  } else {
                    setFile(f);
                    setError("");
                  }
                }}
              />
            </label>
            <label>
              출처 (선택)
              <input
                placeholder="링크 또는 출처 메모"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
          </div>
          <div className="actions">
            <button className="primary" onClick={run}>
              {busy ? "◌ 정리 중…" : "AI로 정리하기"}
            </button>
            <button
              onClick={() => {
                setError("");
                show({ ...blank, source });
              }}
            >
              직접 입력
            </button>
          </div>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </section>
      {draft && (
        <section className="paper form" ref={review}>
          <h2>정리 결과 확인 및 수정</h2>
          <Fields value={draft} onChange={setDraft} />
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                if (!draft.title.trim()) {
                  setError("활동명을 입력해 주세요.");
                  return;
                }
                save(draft);
              }}
            >
              저장
            </button>
            <button onClick={() => setDraft(undefined)}>취소</button>
          </div>
        </section>
      )}
    </>
  );
}
