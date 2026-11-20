import { rowSchema, type Row } from "../../shared/schemas.ts";

export const rowsKey = "campus_deadline_rows_v1";
const firstVisitKey = "campus_deadline_example_initialized_v1";

type ArchiveStorage = Pick<Storage, "getItem" | "setItem">;

function parseRows(raw: string | null): Row[] {
  return raw === null ? [] : rowSchema.array().parse(JSON.parse(raw));
}

export function readRows(storage: ArchiveStorage): Row[] {
  return parseRows(storage.getItem(rowsKey));
}

export function initializeArchive(storage: ArchiveStorage): Row[] {
  const raw = storage.getItem(rowsKey);
  const rows = parseRows(raw);
  if (storage.getItem(firstVisitKey) !== null) return rows;

  // Even an empty saved array means that this browser has used the archive.
  if (raw === null) {
    rows.push({
      id: "moeumi-example-v1",
      isExample: true,
      applied: false,
      createdAt: Date.now(),
      title: "OOO커리어스",
      category: "대외활동",
      organizer: "OOO기업",
      startDate: "2099-12-01",
      endDate: "2099-12-31",
      activityStartDate: "2100-01-10",
      activityEndDate: "2100-01-11",
      participationMethod: "온라인",
      summary: "온라인 활동을 소개하는 예시 공고입니다.",
      otherSchedule: "예시 일정은 모집 후 안내합니다.",
      source: "모으미 사용 예시입니다.",
    });
    storage.setItem(rowsKey, JSON.stringify(rows));
  }
  try {
    storage.setItem(firstVisitKey, "1");
  } catch {
    // The stored array also prevents reseeding. Retry the marker next visit.
  }
  return rows;
}
