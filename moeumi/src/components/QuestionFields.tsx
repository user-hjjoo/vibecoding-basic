import { bases, requirements, unknown, type Fields } from "../../shared/forms";

export type Editable = Omit<Fields, "limit"> & { limit: string };
export function parseFields(draft: Editable): Fields | null {
  const raw = draft.limit.trim();
  const limit = raw === unknown || raw === "제한 없음" ? raw : Number(raw);
  if (!draft.prompt.trim() || (typeof limit === "number" && (!/^\d+$/.test(raw) || !Number.isSafeInteger(limit) || limit <= 0))) return null;
  return { ...draft, prompt: draft.prompt.trim(), details: draft.details.trim(), limit };
}
export function editable(fields: Fields): Editable {
  return { prompt: fields.prompt, details: fields.details, limit: String(fields.limit), basis: fields.basis, required: fields.required };
}
export function QuestionFields({ value, change }: { value: Editable; change: (v: Editable) => void }) {
  return <div className="question-fields">
    <label>질문 내용<textarea rows={2} value={value.prompt}
      onChange={e => change({ ...value, prompt: e.target.value })} /></label>
    <label>글자 수 제한<input value={value.limit} list="question-limits" data-unknown={value.limit === unknown}
      placeholder="숫자, 제한 없음, 확인 필요" onChange={e => change({ ...value, limit: e.target.value })} /></label>
    <label>제한 기준<select value={value.basis} data-unknown={value.basis === unknown}
      onChange={e => change({ ...value, basis: e.target.value as Fields["basis"] })}>
      {bases.map(option => <option key={option}>{option}</option>)}</select></label>
    <label>필수 여부<select value={value.required} data-unknown={value.required === unknown}
      onChange={e => change({ ...value, required: e.target.value as Fields["required"] })}>
      {requirements.map(option => <option key={option}>{option}</option>)}</select></label>
    <label className="question-details-field">문항별 세부 요구사항<textarea rows={2} value={value.details}
      onChange={e => change({ ...value, details: e.target.value })} /></label>
  </div>;
}
