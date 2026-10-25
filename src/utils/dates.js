// Dates for attendance are stored as "YYYY-MM-DD" keys in server local time,
// which avoids timezone drift when grouping by calendar day.

export function toDateKey(d = new Date()) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isWeekend(d) {
  const day = new Date(d).getDay();
  return day === 0 || day === 6;
}

// Every calendar day from start to end inclusive.
export function eachDay(start, end) {
  const days = [];
  const cur = startOfDay(start);
  const last = startOfDay(end);
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Weekdays in range that are not in the holiday key set.
export function businessDays(start, end, holidayKeys = new Set()) {
  return eachDay(start, end).filter((d) => !isWeekend(d) && !holidayKeys.has(toDateKey(d)));
}

export function monthRange(month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}
