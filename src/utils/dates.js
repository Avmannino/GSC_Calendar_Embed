export function parseLocalDate(dateISO) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(dateISO, amount) {
  const date = parseLocalDate(dateISO);
  date.setDate(date.getDate() + amount);

  return toISODate(date);
}

export function startOfWeekMonday(dateISO) {
  const date = parseLocalDate(dateISO);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);

  return toISODate(date);
}

export function getWeekDates(startISO) {
  return Array.from({ length: 7 }, (_, index) => addDays(startISO, index));
}

export function formatMonthDayYear(dateISO) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(parseLocalDate(dateISO));
}

export function formatFullDate(dateISO) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(parseLocalDate(dateISO));
}

export function formatDayTab(dateISO) {
  return {
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "short"
    }).format(parseLocalDate(dateISO)),
    date: new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric"
    }).format(parseLocalDate(dateISO))
  };
}