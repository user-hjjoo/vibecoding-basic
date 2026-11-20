import { test } from "node:test";
import assert from "node:assert/strict";
import { blank, rowSchema } from "../shared/schemas.ts";
import { rowsKey } from "../src/lib/archive.ts";
import { appendNote, colors, noteLimit, notesKey, readNotebook, writeArchiveRows } from "../src/lib/notes.ts";

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test("the example is seeded once independently of the archive; the color rotation survives deletion", () => {
  const store = memory();
  store.setItem(rowsKey, "[]");
  const book = readNotebook(store);
  assert.equal(book.notes.length, 1);
  assert.equal(book.notes[0].color, "yellow");
  assert.equal(book.notes[0].rowId, null);
  book.notes = [];
  store.setItem(notesKey, JSON.stringify(book));
  const restored = readNotebook(store);
  assert.deepEqual(restored.notes, []);
  for (let i = 0; i < noteLimit; i++) {
    const note = appendNote(restored);
    assert.equal(note.color, colors[(i + 1) % colors.length]);
    note.color = "blue";
  }
  assert.throws(() => appendNote(restored), /100장/);
  assert.equal(restored.notes.length, noteLimit);
});

test("bulk archive deletion detaches notes with the latest title and rolls back on write failure", () => {
  const store = memory();
  const row = rowSchema.parse({ ...blank, id: "a", title: "최종 활동명" });
  const second = { ...row, id: "b", title: "다른 공고" };
  const book = readNotebook(store);
  book.notes[0].rowId = row.id;
  const extra = appendNote(book, "준비물");
  extra.rowId = second.id;
  const before = JSON.stringify(book);
  store.setItem(notesKey, before);
  store.setItem(rowsKey, JSON.stringify([row, second]));
  assert.throws(() => writeArchiveRows({ ...store, setItem(key, value) {
    if (key === rowsKey) throw Error("full");
    store.setItem(key, value);
  } }, [row, second], []));
  assert.equal(store.getItem(notesKey), before);
  writeArchiveRows(store, [row, second], []);
  const notes = readNotebook(store).notes;
  assert.equal(notes.length, 2);
  assert.ok(notes.every(note => note.rowId === null));
  assert.deepEqual(notes.map(note => note.deletedTitle), [second.title, row.title]);
  assert.equal(notes[0].content, "준비물");
});

test("an unsupported or corrupt notebook is never reseeded", () => {
  const store = memory();
  for (const raw of ['{"version":2,"notes":[]}', "broken"]) {
    store.setItem(notesKey, raw);
    assert.throws(() => readNotebook(store));
    assert.equal(store.getItem(notesKey), raw);
  }
});
