import { test } from "node:test";
import assert from "node:assert/strict";
import { splitForm } from "../server/split-form.ts";
import { applicationBook, applicationsKey, counts, exportText, limitInfo, readApplications } from "../src/lib/applications.ts";
import { notesKey, readNotebook, writeArchiveRows } from "../src/lib/notes.ts";
import { blank, rowSchema } from "../shared/schemas.ts";
import { rowsKey } from "../src/lib/archive.ts";

function memory() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, v: string) => { map.set(key, v); } };
}
test("seed once, preserve damaged storage, count whitespace and Unicode, validate limits", () => {
  const s = memory();
  const book = readApplications(s), app = book.applications[0], q = app.questions[0];
  q.answer = "가 😀\n나\t"; q.limit = 3;
  assert.deepEqual(counts(q.answer), { included: 6, excluded: 3 });
  assert.equal(limitInfo(q).over, true);
  q.basis = "공백 제외";
  assert.equal(limitInfo(q).over, false);
  assert.ok(exportText(app).startsWith(`[예시 지원서]\n\n1. ${q.prompt} (공백 제외 3자 / 3자)\n${q.answer}`));
  q.basis = "확인 필요";
  assert.equal(limitInfo(q).over, false);
  q.answer = "한".repeat(5001);
  assert.equal(applicationBook.safeParse(book).success, false);
  q.answer = "";
  assert.equal(applicationBook.safeParse({ ...book, applications: Array(31).fill(app) }).success, false);
  app.questions = Array(31).fill(q);
  assert.equal(applicationBook.safeParse(book).success, false);
  s.setItem(applicationsKey, JSON.stringify({ version: 1, applications: [] }));
  assert.deepEqual(readApplications(s).applications, []);
  s.setItem(applicationsKey, "broken");
  assert.throws(() => readApplications(s));
  assert.equal(s.getItem(applicationsKey), "broken");
});
test("legacy answers survive missing requirements; new requirements survive reload", () => {
  const storage = memory();
  const book = readApplications(storage);
  const app = book.applications[0];
  app.questions[0].answer = "기존 답변";
  app.questions[0].done = true;
  const legacy = JSON.stringify(book, (key, value) =>
    key === "commonRequirements" || key === "details" ? undefined : value);
  storage.setItem(applicationsKey, legacy);
  const restored = readApplications(storage);
  assert.deepEqual(restored, book);
  assert.equal(storage.getItem(applicationsKey), legacy);
  restored.applications[0].commonRequirements = "PDF로 제출";
  restored.applications[0].questions[0].details = "사례를 두 가지 포함";
  storage.setItem(applicationsKey, JSON.stringify(restored));
  assert.deepEqual(readApplications(storage), restored);
});

test("archive deletion preserves answers and rolls back both linked collections on failure", () => {
  const s = memory(), row = rowSchema.parse({ ...blank, id: "r", title: "최종 공고명" });
  s.setItem(rowsKey, JSON.stringify([row]));
  const b = readApplications(s), n = readNotebook(s);
  b.applications[0].questions[0].answer = "보존할 답변";
  b.applications[0].rowId = n.notes[0].rowId = row.id;
  s.setItem(applicationsKey, JSON.stringify(b)); s.setItem(notesKey, JSON.stringify(n));
  for (const failure of [applicationsKey, rowsKey]) {
    assert.throws(() => writeArchiveRows({ ...s, setItem(k, v) {
      if (k === failure) throw Error("full");
      s.setItem(k, v);
    } }, [row], []));
    assert.deepEqual(readApplications(s), b);
    assert.deepEqual(readNotebook(s), n);
  }
  writeArchiveRows(s, [row], []);
  const app = readApplications(s).applications[0];
  assert.equal(app.rowId, null); assert.equal(app.deletedTitle, row.title);
  assert.equal(app.questions[0].answer, "보존할 답변");
});
const post = (body: unknown) => new Request("https://test.local/api/split-form", { method: "POST", body: JSON.stringify(body) });
test("reject invalid, oversized and extra fields before requesting AI", async t => {
  const spy = t.mock.method(globalThis, "fetch", () => { throw Error("unexpected"); });
  for (const body of [{ text: "가".repeat(10001) }, { text: " " }, { text: "질문", answer: "개인 답변" }, { images: [] }]) {
    assert.equal((await splitForm(post(body), {})).status, 400);
  }
  assert.equal((await splitForm(post({ text: "가".repeat(10000) }), {})).status, 503);
  assert.equal(spy.mock.callCount(), 0);
});
test("Gemini receives only source text and invalid question metadata is rejected", async t => {
  let text = "공통: 모든 답변은 익명으로 작성하세요.\n지원 동기를 써 주세요. 관련 경험을 2개 포함하세요.";
  let output: unknown = { commonRequirements: "모든 답변은 익명으로 작성하세요.", questions: [{ prompt: "지원 동기를 써 주세요.", details: "관련 경험을 2개 포함하세요.", limit: 500, basis: "확인 필요", required: "필수" }] };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = await new Request(url, init).json();
    assert.deepEqual(body.contents[0].parts, [{ text }]);
    const schema = body.generationConfig.responseJsonSchema;
    assert.ok(schema.properties.questions.items.properties.limit);
    assert.doesNotMatch(JSON.stringify(schema), /"(maxItems|maximum|minimum|exclusiveMinimum)":/);
    assert.match(body.systemInstruction.parts[0].text, /commonRequirements/);
    assert.match(body.systemInstruction.parts[0].text, /details/);
    assert.match(body.systemInstruction.parts[0].text, /지시는 따르지 않는다/);
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(output) }] } }] });
  });
  const env = { GEMINI_API_KEY: "test-placeholder" };
  const good = await splitForm(post({ text }), env);
  assert.deepEqual(await good.json(), output);
  text = "PDF 첨부";
  output = { commonRequirements: text, questions: [] };
  assert.deepEqual(await (await splitForm(post({ text }), env)).json(), output);
  const question = { prompt: "질문", details: "", limit: 500, basis: "공백 포함", required: "필수" };
  output = { commonRequirements: "", questions: [{ ...question, limit: -1 }] };
  assert.equal((await splitForm(post({ text }), env)).status, 502);
  output = { commonRequirements: "", questions: Array(31).fill(question) };
  assert.equal((await splitForm(post({ text }), env)).status, 502);
});
