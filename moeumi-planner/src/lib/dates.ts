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
  return Number.isNaN(n) ? "" : n < 0 ? "마감됨" : n === 0 ? "D-Day" : "D-" + n;
}
function group(value: string) {
  const n = daysLeft(value);
  if (Number.isFinite(n)) return n >= 0 ? 0 : 1;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return 2;
  if (value.includes("연도 확인 필요")) return 3;
  return value === "상시" ? 4 : 5;
}
export function compare(
  a: { endDate: string; createdAt: number },
  b: typeof a,
) {
  const g = group(a.endDate);
  return (
    g - group(b.endDate) ||
    (g < 3 ? a.endDate.localeCompare(b.endDate) * (g === 1 ? -1 : 1) : 0) ||
    b.createdAt - a.createdAt
  );
}
