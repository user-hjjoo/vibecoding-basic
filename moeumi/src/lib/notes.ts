import { z } from "zod";
import type { Row } from "../../shared/schemas.ts";
import { applicationBook, applicationsKey } from "./applications.ts";
import { rowsKey } from "./archive.ts";

export const notesKey = "campus_deadline_notes_v1";
export const colors = ["yellow", "pink", "blue", "green"] as const;
export const noteLimit = 100;
export const textLimit = 500;
const noteSchema = z.object({
  id: z.string(), content: z.string().max(textLimit), color: z.enum(colors),
  rowId: z.string().nullable(), deletedTitle: z.string().optional(),
  createdAt: z.number(), updatedAt: z.number(),
});
const bookSchema = z.object({
  version: z.literal(1), nextColorIndex: z.number().int().min(0).max(3),
  notes: z.array(noteSchema).max(noteLimit),
});
export type Notebook = z.infer<typeof bookSchema>;
export type Note = z.infer<typeof noteSchema>;
type Store = Pick<Storage, "getItem" | "setItem">;

export function editTime(book: Notebook) {
  return Math.max(Date.now(), ...book.notes.map(note => note.updatedAt + 1));
}

export function appendNote(book: Notebook, content = ""): Note {
  if (book.notes.length >= noteLimit) throw Error("메모는 100장까지예요");
  const time = editTime(book);
  const note = { id: crypto.randomUUID(), content, color: colors[book.nextColorIndex],
    rowId: null, createdAt: time, updatedAt: time };
  book.notes.unshift(note);
  book.nextColorIndex = (book.nextColorIndex + 1) % colors.length;
  return note;
}

export function readNotebook(storage: Store): Notebook {
  const raw = storage.getItem(notesKey);
  if (raw !== null) return bookSchema.parse(JSON.parse(raw));
  const book: Notebook = { version: 1, nextColorIndex: 0, notes: [] };
  appendNote(book, "예시 메모: 지원 동기 초안, 준비할 서류, 면접 질문을 여기에 적어 두세요");
  storage.setItem(notesKey, JSON.stringify(book));
  return book;
}

// Rename badges use the live archive title. On deletion keep its final value.
export function writeArchiveRows(storage: Store, previous: Row[], next: Row[]) {
  const nextIds = new Set(next.map(row => row.id));
  const removed = new Map(previous.filter(row => !nextIds.has(row.id)).map(row => [row.id, row.title]));
  const writes: { key: string; original: string; next: string }[] = [];
  if (removed.size) {
    for (const key of [notesKey, applicationsKey]) {
      const original = storage.getItem(key);
      if (original === null) continue;
      const data = JSON.parse(original);
      const book = key === notesKey ? bookSchema.parse(data) : applicationBook.parse(data);
      const items = "notes" in book ? book.notes : book.applications;
      let changed = false;
      for (const item of items) {
        const title = item.rowId === null ? undefined : removed.get(item.rowId);
        if (title === undefined) continue;
        item.rowId = null;
        item.deletedTitle = title;
        changed = true;
      }
      if (changed) writes.push({ key, original, next: JSON.stringify(book) });
    }
  }
  let written = 0;
  try {
    for (const write of writes) {
      storage.setItem(write.key, write.next);
      written++;
    }
    storage.setItem(rowsKey, JSON.stringify(next));
  } catch (err) {
    for (const write of writes.slice(0, written).reverse()) storage.setItem(write.key, write.original);
    throw err;
  }
}
