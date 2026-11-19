import type { Row } from "../../shared/schemas.ts";
import { compare, daysLeft, newestFirst } from "./dates.ts";

export const sortLabels = {
  deadline: "마감 임박 순",
  recent: "최근 등록 순",
  custom: "사용자 지정 순",
};
export type SortMode = keyof typeof sortLabels;
export const sortKey = "campus_deadline_sort_v1";

export function commitSort(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, rowsKey: string, original: Row[], edited: Row[], mode: SortMode) {
  const previousMode = storage.getItem(sortKey);
  const modeChanged = previousMode !== mode;
  const orderChanged = edited.some((row, i) => row.customOrder !== original[i]?.customOrder);
  if (modeChanged) storage.setItem(sortKey, mode);
  try {
    if (orderChanged) storage.setItem(rowsKey, JSON.stringify(edited));
  } catch (error) {
    if (modeChanged) {
      if (previousMode === null) storage.removeItem(sortKey);
      else storage.setItem(sortKey, previousMode);
    }
    throw error;
  }
}

export function readMode(): SortMode {
  const value = localStorage.getItem(sortKey);
  return value === "recent" || value === "custom" ? value : "deadline";
}

function byRank(a: Row, b: Row) {
  return (a.customOrder ?? Infinity) - (b.customOrder ?? Infinity) || compare(a, b);
}

export function sortRows(rows: Row[], mode: SortMode) {
  if (mode === "deadline") return [...rows].sort(compare);
  return [...rows].sort((a, b) => {
    const expired = Number(daysLeft(a.endDate) < 0) - Number(daysLeft(b.endDate) < 0);
    return expired || (mode === "recent" ? newestFirst(a, b) : byRank(a, b));
  });
}

export function initializeOrder(rows: Row[]) {
  if (rows.every(row => row.customOrder !== undefined)) return rows;
  const ranks = new Map([...rows].sort(byRank).map((row, index) => [row.id, index]));
  return rows.map(row => ({ ...row, customOrder: ranks.get(row.id)! }));
}

export function prependRow(rows: Row[], row: Row, mode: SortMode) {
  if (mode === "custom" || rows.some(item => item.customOrder !== undefined)) {
    const first = rows.reduce((min, item) => Math.min(min, item.customOrder ?? 0), 0);
    return [...rows, { ...row, customOrder: first - 1 }];
  }
  return [...rows, row];
}

export function moveRow(rows: Row[], id: string, targetId: string) {
  const ordered = [...rows].sort(byRank);
  const from = ordered.findIndex(row => row.id === id);
  const to = ordered.findIndex(row => row.id === targetId);
  if (from < 0 || to < 0 || from === to) return rows;
  if ((daysLeft(ordered[from].endDate) < 0) !== (daysLeft(ordered[to].endDate) < 0)) return rows;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  const ranks = new Map(ordered.map((row, index) => [row.id, index]));
  return rows.map(row => ({ ...row, customOrder: ranks.get(row.id)! }));
}
