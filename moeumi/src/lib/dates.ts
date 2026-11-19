const day = 86400000;
export function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const ms = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(ms) && new Date(ms).toISOString().startsWith(value)
    ? ms
    : NaN;
}
export function today(now = new Date()) {
  return Math.floor((now.getTime() + 9 * 3600000) / day) * day;
}
export function daysLeft(value: string) {
  return (dateValue(value) - today()) / day;
}
export function deadlineLabel(value: string) {
  const n = daysLeft(value);
  return Number.isNaN(n) ? "" : n < 0 ? "마감 지남" : n === 0 ? "D-Day" : "D-" + n;
}
const expiredGroup = 5;
function group(value: string) {
  const n = daysLeft(value);
  if (Number.isFinite(n)) return n >= 0 ? 0 : expiredGroup;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return 1;
  if (value.includes("연도 확인 필요")) return 2;
  return value === "상시" ? 3 : 4;
}
export function newestFirst(a: { createdAt?: number | null }, b: typeof a) {
  if (a.createdAt == null) return b.createdAt == null ? 0 : 1;
  if (b.createdAt == null) return -1;
  return b.createdAt - a.createdAt;
}
export function compare(
  a: { endDate: string; createdAt?: number | null },
  b: typeof a,
) {
  const g = group(a.endDate);
  return (
    g - group(b.endDate) ||
    (g === expiredGroup ? b.endDate.localeCompare(a.endDate) : 0) ||
    (g <= 1 ? a.endDate.localeCompare(b.endDate) : 0) ||
    newestFirst(a, b)
  );
}
