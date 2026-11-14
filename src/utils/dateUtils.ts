/**
 * Date and Week utilities for the fitness tracking application.
 * All weekly cycles align with standard ISO weeks (Monday to Sunday).
 */

export function formatDateToYYYYMMDD(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getIsoWeekNumber(d: Date = new Date()): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (make Sunday day 7)
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

export function getIsoWeekId(date: Date = new Date()): string {
  const { year, week } = getIsoWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getPreviousIsoWeekId(date: Date = new Date()): string {
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 7);
  return getIsoWeekId(prevDate);
}

export function getDaysRemainingInWeek(date: Date = new Date()): number {
  // Monday is day 1, Sunday is day 7 (or 0 in JS getDay())
  const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  return Math.max(0, 7 - isoDay);
}

export function getWeekStartAndEnd(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  
  const start = new Date(d.setDate(diffToMonday));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getDayAbbreviation(dayIndex: number): string {
  // 0 = Mon, 1 = Tue, ..., 6 = Sun
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return names[dayIndex] || '';
}
