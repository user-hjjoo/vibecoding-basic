import { test } from "node:test";
import assert from "node:assert/strict";
import { blank, rowSchema } from "../shared/schemas.ts";
import { rowsKey } from "../src/lib/archive.ts";
import { commitListEdit, initializeOrder, moveRow, prependRow, sortKey, sortRows } from "../src/lib/sort.ts";

function row(id: string, endDate: string, createdAt?: number) {
  return rowSchema.parse({ ...blank, title: id, id, endDate, createdAt });
}
const records = [
  row("legacy", "상시"), row("old", "2001-02-01", 10),
  row("soon", "2099-01-01", 15), row("month", "2099-02", 20),
  row("older deadline", "2000-01-01", 30), row("expired legacy", "1999-01-01")
];
test("draft moves leave saved rows alone and a failed apply restores the previous mode", () => {
  const saved = new Map([[rowsKey, JSON.stringify(records)], [sortKey, "recent"]]);
  let full = true;
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    removeItem: (key: string) => { saved.delete(key); },
    setItem: (key: string, value: string) => {
      if (full && key === rowsKey) throw Error("storage full");
      saved.set(key, value);
    },
  };
  const edited = moveRow(initializeOrder(records), "legacy", "soon");
  assert.equal(saved.get(rowsKey), JSON.stringify(records));
  assert.throws(() => commitListEdit(storage, records, edited, "custom"));
  assert.equal(saved.get(sortKey), "recent");
  assert.equal(saved.get(rowsKey), JSON.stringify(records));
  full = false;
  commitListEdit(storage, records, edited, "custom");
  assert.equal(saved.get(sortKey), "custom");
  assert.equal(saved.get(rowsKey), JSON.stringify(edited));
  const kept = records.slice(1);
  commitListEdit(storage, records, kept, "recent");
  assert.equal(saved.get(rowsKey), JSON.stringify(kept));
  commitListEdit(storage, kept, [], "recent");
  assert.equal(saved.get(rowsKey), "[]");
});
test("recent order sorts independently in open and expired groups, missing times last", () => {
  assert.deepEqual(sortRows(records, "recent").map(r => r.id),
    ["month", "soon", "legacy", "older deadline", "old", "expired legacy"]);
  assert.equal(records[0].createdAt, undefined);
});
test("custom order seeds from deadline order and moves within each group", () => {
  const saved = initializeOrder(records);
  assert.deepEqual(sortRows(saved, "custom"), sortRows(saved, "deadline"));
  assert.deepEqual(saved.map(r => r.id), records.map(r => r.id));
  const moved = moveRow(moveRow(saved, "legacy", "soon"), "expired legacy", "old");
  assert.deepEqual(sortRows(moved, "custom").map(r => r.id),
    ["legacy", "soon", "month", "expired legacy", "old", "older deadline"]);
  assert.equal(moveRow(moved, "legacy", "old"), moved);
  assert.equal(initializeOrder(moved), moved);
});
test("new rows prepend even in another mode, edits keep rank and removal drops it", () => {
  const newRow = row("new", "상시", 50);
  const saved = initializeOrder(records);
  const updated = prependRow(saved, newRow, "recent").map(r =>
    r.id === "legacy" ? { ...r, title: "edited", applied: true } : r
  ).filter(r => r.id !== "month");
  const restored = rowSchema.array().parse(JSON.parse(JSON.stringify(updated)));
  assert.deepEqual(sortRows(restored, "custom").slice(0, 3).map(r => r.id),
    ["new", "soon", "legacy"]);
  assert.equal(sortRows(restored, "custom")[2].applied, true);
  assert.equal(prependRow(records, newRow, "deadline").at(-1)?.customOrder, undefined);
});
