import { z } from "zod";
import { charCount, emptyFields, maxAnswer, maxForms, maxQuestions, questionFields, type Fields } from "../../shared/forms.ts";

export const applicationsKey = "campus_deadline_applications_v1";
const questionSchema = questionFields.extend({
  details: z.string().default(""),
  id: z.string(), order: z.number().int().nonnegative(),
  answer: z.string().refine(s => charCount(s) <= maxAnswer), done: z.boolean(),
});
export type Question = z.infer<typeof questionSchema>;
const applicationSchema = z.object({
  id: z.string(), title: z.string().trim().min(1), rowId: z.string().nullable(),
  commonRequirements: z.string().default(""),
  deletedTitle: z.string().optional(), questions: z.array(questionSchema).max(maxQuestions),
  createdAt: z.number(), updatedAt: z.number(),
});
export type Application = z.infer<typeof applicationSchema>;
export const applicationBook = z.object({
  version: z.literal(1), applications: z.array(applicationSchema).max(maxForms),
});
export type Book = z.infer<typeof applicationBook>;

export function newQuestion(fields: Fields, order: number): Question {
  return { ...fields, id: crypto.randomUUID(), order, answer: "", done: false };
}
export function newApplication(title: string, rowId: string | null, fields: Fields[], commonRequirements = ""): Application {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: title.trim(), rowId, commonRequirements, questions: fields.map(newQuestion),
    createdAt: now, updatedAt: now };
}
export function readApplications(storage: Pick<Storage, "getItem" | "setItem">): Book {
  const raw = storage.getItem(applicationsKey);
  if (raw !== null) return applicationBook.parse(JSON.parse(raw));
  const example = newApplication("예시 지원서", null, [
    { ...emptyFields, prompt: "예시 질문 1. 이 활동에 지원한 동기를 들려주세요.", limit: 500, basis: "공백 포함", required: "필수" },
    { ...emptyFields, prompt: "예시 질문 2. 함께 일하며 문제를 해결한 경험을 소개해 주세요.", limit: 1000, basis: "공백 제외", required: "선택" },
  ]);
  const book: Book = { version: 1, applications: [example] };
  storage.setItem(applicationsKey, JSON.stringify(book));
  return book;
}
export function counts(answer: string) {
  return { included: charCount(answer), excluded: charCount(answer.replace(/\s/gu, "")) };
}
export function limitInfo(q: Question) {
  const { included, excluded } = counts(q.answer);
  const count = q.basis === "공백 포함" ? included : q.basis === "공백 제외" ? excluded : null;
  const format = (n: number) => n.toLocaleString("ko-KR");
  const both = `공백 포함 ${format(included)}자 / 공백 제외 ${format(excluded)}자`;
  const limitText = typeof q.limit === "number" ? `${q.limit}자` : q.limit;
  const detail = count === null ? `${both} · ${limitText} · 기준 확인 필요`
    : `${q.basis} ${format(count)}자 / ${limitText}`;
  return { both, detail, over: count !== null && typeof q.limit === "number" && count > q.limit };
}
export function exportText(app: Application) {
  return [`[${app.title}]`, ...app.questions.map((q, i) =>
    `${i + 1}. ${q.prompt} (${limitInfo(q).detail})\n${q.answer}`)].join("\n\n");
}
