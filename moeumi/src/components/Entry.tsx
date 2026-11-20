import React, { useEffect, useRef, useState } from "react";
import {
  blank,
  categories,
  draftSchema,
  labels,
  type Draft,
} from "../../shared/schemas";
import { imageError, prepareImages } from "../lib/image";
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
export function Entry({ save, close }: { save: (v: Draft) => boolean; close: () => void }) {
  const [text, setText] = useState(""),
    [source, setSource] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [draft, setDraft] = useState<Draft>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null),
    lock = useRef(false),
    review = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    ref.current?.focus();
    return () => {
      request.current?.abort();
      element.close();
    };
  }, []);
  function show(value: Draft) {
    setDraft(value);
    requestAnimationFrame(() =>
      review.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }
  async function run() {
    if (lock.current) return;
    setError("");
    if (!text.trim() && !files.length) {
      setError("모집글이나 포스터를 입력해 주세요.");
      ref.current?.focus();
      return;
    }
    lock.current = true;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const body = JSON.stringify({
        text,
        images: await prepareImages(files),
      });
      if (new Blob([body]).size > 4000000)
        throw Error("첨부한 사진의 전체 용량이 커요. 사진 수를 줄이거나 필요한 부분만 잘라 주세요.");
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw Error(
          data.message ||
            (res.status === 413
              ? "이미지를 줄여 주세요."
              : "서버 연결을 확인해 주세요."),
        );
      if (!controller.signal.aborted) show({ ...draftSchema.parse(data), source });
    } catch (e) {
      if (controller.signal.aborted) return;
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
    <dialog ref={dialog} className="entry-dialog" aria-labelledby="entry-title"
      onCancel={event => { event.preventDefault(); close(); }}>
      <div className="sectionTitle">
        <h2 id="entry-title">모집공고 추가</h2>
        <button type="button" onClick={close}>닫기</button>
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
              포스터 첨부 · 최대 3장 (JPG·PNG, 장당 10MB)
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  const selected = Array.from(e.currentTarget.files ?? []);
                  e.currentTarget.value = "";
                  const accepted = selected.slice(0, 3 - files.length);
                  const invalid = accepted.find(file => imageError(file));
                  if (invalid) {
                    setError(invalid.name + " · " + imageError(invalid));
                    return;
                  }
                  setFiles([...files, ...accepted]);
                  setError(selected.length > accepted.length ? "사진은 최대 3장까지 올릴 수 있어요" : "");
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
          {files.length > 0 && (
            <div className="attachments">
              <strong>첨부한 사진 {files.length}장</strong>
              <ol>
                {files.map((file, index) => (
                  <li key={index}>
                    <span>{index + 1}. {file.name}</span>
                    <button type="button" aria-label={`${index + 1}번째 사진 제외: ${file.name}`}
                      onClick={() => {
                        setFiles(current => current.filter((_, i) => i !== index));
                        setError("");
                      }}>제외</button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <small id="ai-transfer-notice">AI로 정리하면 모집글 본문과 첨부 사진이 Google Gemini로 전송돼요. 출처 메모는 이 브라우저에만 저장돼요.</small>
          <div className="actions">
            <button className="primary" aria-describedby="ai-transfer-notice" onClick={run}>
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
                if (!save(draft)) setError("저장하지 못했어요. 브라우저 저장 권한과 남은 공간을 확인해 주세요.");
              }}
            >
              저장
            </button>
            <button onClick={() => setDraft(undefined)}>취소</button>
          </div>
        </section>
      )}
    </dialog>
  );
}
