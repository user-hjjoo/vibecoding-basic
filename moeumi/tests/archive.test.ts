import { test } from "node:test";
import assert from "node:assert/strict";
import { dateValue, compare, today } from "../src/lib/dates.ts";
import { rowSchema, blank } from "../shared/schemas.ts";
import { extract } from "../server/extract.ts";
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
    "2000-03-01",
    "2000-01-01",
    "2026-11",
    "3월 (연도 확인 필요)",
    "상시",
    "확인 필요",
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
test("legacy rows restore missing fields", () => {
  const { otherSchedule, ...legacy } = blank;
  assert.equal(
    rowSchema.parse({ ...legacy, id: "old", createdAt: 1 }).otherSchedule,
    "미입력",
  );
});
test("API validation and missing credentials", async () => {
  for (const [body, code] of [
    [{}, 400],
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
