const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // "2020-01-31" is a calendar date, not an instant: read it as local so it never slips a day.
  const m = DATE_ONLY.exec(iso);
  const d = m && iso.length <= 10 ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "31/1/2020", or "" when the value is missing or not a date. */
export function formatDate(iso: string | null | undefined): string {
  return toDate(iso)?.toLocaleDateString("vi-VN") ?? "";
}

/** "14:05 31/1/2020", or "" when the value is missing or not a date. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "";
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${time} ${d.toLocaleDateString("vi-VN")}`;
}
