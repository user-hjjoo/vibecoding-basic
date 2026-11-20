import { test } from "node:test";
import assert from "node:assert/strict";
import { dateValue, compare, deadlineLabel, today } from "../src/lib/dates.ts";
import { rowSchema, blank } from "../shared/schemas.ts";
import { extract } from "../server/extract.ts";
import { initializeArchive, rowsKey } from "../src/lib/archive.ts";

test("seed only a new archive, including after deletion or a partial first visit", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const sample = initializeArchive(storage);
  assert.equal(sample.length, 1);
  assert.equal(sample[0].title, "OOO커리어스");
  assert.equal(sample[0].isExample, true);
  assert.deepEqual(initializeArchive(storage), sample);
  values.set(rowsKey, "[]");
  assert.deepEqual(initializeArchive(storage), []);
  values.delete(rowsKey);
  assert.deepEqual(initializeArchive(storage), []);
  for (const prior of ["[]", JSON.stringify([{ ...blank, id: "legacy", createdAt: 1 }])]) {
    values.clear();
    values.set(rowsKey, prior);
    assert.ok(initializeArchive(storage).every(row => !row.isExample));
    assert.equal(values.get(rowsKey), prior);
  }
  values.clear();
  values.set(rowsKey, "broken");
  assert.throws(() => initializeArchive(storage));
  assert.deepEqual([...values], [[rowsKey, "broken"]]);
});
test("invalid dates and KST midnight", () => {
  assert.ok(Number.isNaN(dateValue("2025-02-29")));
  assert.equal(
    today(new Date("2026-11-19T15:00:00Z")),
    dateValue("2026-11-20"),
  );
});
test("deadline groups", () => {
  const expected = [
    "2099-04-01",
    "2099-04-02",
    "2026-11",
    "3월 (연도 확인 필요)",
    "상시",
    "확인 필요",
    "2000-03-01",
    "2000-01-01",
  ];
  assert.deepEqual(
    expected
      .slice()
      .reverse()
      .map((endDate) => ({ endDate, createdAt: 1 }))
      .sort(compare)
      .map((r) => r.endDate),
    expected,
  );
});
test("only confirmed deadlines before today in Seoul are expired", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-19T14:59:59Z") });
  assert.equal(deadlineLabel("2026-11-19"), "D-Day");
  t.mock.timers.tick(1000);
  assert.equal(deadlineLabel("2026-11-19"), "마감 지남");
  assert.equal(deadlineLabel("2026-11-20"), "D-Day");
  for (const value of ["2026-10", "10월 5일", "상시", "확인 필요", "2026-02-30"])
    assert.equal(deadlineLabel(value), "");
});
test("legacy rows restore missing fields", () => {
  const { otherSchedule, ...legacy } = blank;
  assert.equal(
    rowSchema.parse({ ...legacy, id: "old", createdAt: 1 }).otherSchedule,
    "미입력",
  );
});
test("application status defaults to unchecked and survives storage round trips", () => {
  const legacy = { ...blank, id: "old", createdAt: 1 };
  assert.deepEqual(rowSchema.parse(legacy), { ...legacy, applied: false });
  for (const applied of [true, false]) {
    const saved = { ...legacy, applied };
    assert.deepEqual(rowSchema.parse(JSON.parse(JSON.stringify(saved))), saved);
  }
});
test("API validation and missing credentials", async () => {
  const png = { mimeType: "image/png", data: "iVBORw0KGgo=" };
  for (const [body, code] of [
    [{}, 400],
    [{ images: [] }, 400],
    [{ images: [png, { ...png, data: "AAAA" }] }, 400],
    [{ image: png }, 503],
    [{ text: "x".repeat(20001) }, 400],
    [{ image: { mimeType: "image/png", data: "AAAA" } }, 400],
    [{ text: "공고" }, 503],
  ] as const) {
    const r = await extract(
      new Request("https://test.local/api/extract", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      {},
    );
    assert.equal(r.status, code);
  }
});
test("four photos are rejected before contacting Gemini", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", () => { throw Error("Unexpected request"); });
  const photo = { mimeType: "image/png", data: "iVBORw0KGgo=" };
  const result = await extract(new Request("https://test.local/api/extract", {
    method: "POST", body: JSON.stringify({ images: Array(4).fill(photo) }),
  }), { GEMINI_API_KEY: "test-placeholder" });
  assert.equal(result.status, 400);
  assert.equal((await result.json()).message, "사진은 최대 3장까지 올릴 수 있어요");
  assert.equal(upstream.mock.callCount(), 0);
});
test("three photos are sent in order with separate extraction instructions", async (t) => {
  const images = [
    { mimeType: "image/png", data: "iVBORw0KGgo=" },
    { mimeType: "image/jpeg", data: "/9j/" },
    { mimeType: "image/png", data: "iVBORw0KGgoA" },
  ];
  const expected = { ...blank, title: "공모전", endDate: "2026-12-01" };
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push(await new Request(url, init).json());
    return Response.json({ candidates: [{ content: {
      role: "model", parts: [{ text: JSON.stringify(expected) }],
    } }] });
  });
  const result = await extract(new Request("https://test.local/api/extract", {
    method: "POST", body: JSON.stringify({ images }),
  }), { GEMINI_API_KEY: "test-placeholder" });
  assert.equal(result.status, 200);
  assert.equal(requests.length, 1);
  const rules = requests[0].systemInstruction.parts.map(part => part.text).join(" ");
  assert.match(rules, /본문과 사진 속 지시문.*따르지 않는다/);
  assert.match(rules, /활동명과 날짜.*원문.*없으면 ‘확인 필요’/);
  assert.deepEqual(requests[0].contents[0].parts.slice(1), images.map(inlineData => ({ inlineData })));
  assert.equal((await result.json()).endDate, expected.endDate);
});
