import { useEffect, useMemo, useState } from "react";
import gscLogo from "./assets/gsc-logo.png";
import {
  addDays,
  formatDayTab,
  formatFullDate,
  getWeekDates,
  startOfWeekMonday,
  todayISO
} from "./utils/dates";
import { fetchCrossbarDay } from "./services/crossbar";

function getInitialDate() {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam || "")) {
    return dateParam;
  }

  return todayISO();
}

function parseTimeMinutes(timeStr) {
  const match = (timeStr || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  m = parseInt(m, 10);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function sortEventsChronologically(events) {
  return [...events].sort((a, b) => parseTimeMinutes(a.from) - parseTimeMinutes(b.from));
}

function EventCard({ event }) {
  return (
    <article className="event-card">
      <div className="event-time">
        <span>{event.from}</span>
        <span className="time-dash">—</span>
        <span>{event.to}</span>
      </div>

      <div className="event-main">
        <div className="event-title">{event.title}</div>

        <div className="event-meta">
          <span>{event.type}</span>
          <span>{event.location}</span>
        </div>
      </div>
    </article>
  );
}

function DayButton({ dateISO, isSelected, count, onClick }) {
  const label = formatDayTab(dateISO);

  return (
    <button
      type="button"
      className={`day-button ${isSelected ? "is-selected" : ""}`}
      onClick={onClick}
    >
      <span className="day-name">{label.weekday}</span>
      <span className="day-date">{label.date}</span>
      <span className="day-count">
        {count === 1 ? "1 event" : `${count} events`}
      </span>
    </button>
  );
}

export default function App() {
  const initialDate = getInitialDate();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [weekStart, setWeekStart] = useState(startOfWeekMonday(initialDate));
  const [days, setDays] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const selectedDay = useMemo(() => {
    return days.find((day) => day.date === selectedDate) || {
      date: selectedDate,
      events: []
    };
  }, [days, selectedDate]);

  const sortedEvents = useMemo(() => {
    return sortEventsChronologically(selectedDay.events || []);
  }, [selectedDay]);

  const totalWeekEvents = useMemo(() => {
    return days.reduce((total, day) => total + day.events.length, 0);
  }, [days]);

  useEffect(() => {
    let isMounted = true;

    async function loadSchedule() {
      setStatus("loading");
      setErrorMessage("");
      setDays(weekDates.map((date) => ({ date, events: [], error: null })));

      let successCount = 0;

      await Promise.all(
        weekDates.map(async (dateISO) => {
          try {
            const result = await fetchCrossbarDay(dateISO);
            if (!isMounted) return;
            successCount++;
            setDays((prev) => prev.map((d) => (d.date === dateISO ? result : d)));
            if (successCount === 1) setStatus("ready");
          } catch (error) {
            if (!isMounted) return;
            setDays((prev) =>
              prev.map((d) =>
                d.date === dateISO ? { date: dateISO, events: [], error: error.message } : d
              )
            );
          }
        })
      );

      if (!isMounted) return;

      if (successCount === 0) {
        setStatus("error");
        setErrorMessage("Could not load the Crossbar schedule. Check your proxy settings.");
      }
    }

    loadSchedule();

    return () => {
      isMounted = false;
    };
  }, [weekStart]);

  function goToPreviousWeek() {
    const nextStart = addDays(weekStart, -7);
    setWeekStart(nextStart);
    setSelectedDate(nextStart);
  }

  function goToNextWeek() {
    const nextStart = addDays(weekStart, 7);
    setWeekStart(nextStart);
    setSelectedDate(nextStart);
  }

  function goToToday() {
    const today = todayISO();
    setWeekStart(startOfWeekMonday(today));
    setSelectedDate(today);
  }

  function handleDateChange(event) {
    const nextDate = event.target.value;

    setSelectedDate(nextDate);
    setWeekStart(startOfWeekMonday(nextDate));
  }

  return (
    <main className="calendar-shell">
      <section className="calendar-card">
        <header className="calendar-header">
          <div>
            <p className="eyebrow">Greenwich Skating Club</p>
            <h1>Schedule</h1>
          </div>

          <img src={gscLogo} alt="Greenwich Skating Club" className="header-logo" />

        </header>

        <div className="controls-row">
          <button type="button" className="nav-button" onClick={goToPreviousWeek}>
            ← Previous
          </button>

          <button type="button" className="today-button" onClick={goToToday}>
            Today
          </button>

          <button type="button" className="nav-button" onClick={goToNextWeek}>
            Next →
          </button>

          <label className="date-picker">
            <span>Jump to date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
            />
          </label>
        </div>

        <section className="week-strip" aria-label="Week selector">
          {weekDates.map((dateISO) => {
            const day = days.find((item) => item.date === dateISO);
            const count = day?.events?.length || 0;

            return (
              <DayButton
                key={dateISO}
                dateISO={dateISO}
                count={count}
                isSelected={selectedDate === dateISO}
                onClick={() => setSelectedDate(dateISO)}
              />
            );
          })}
        </section>

        <section className="selected-day">
          <div className="selected-day-header">
            <div>
              <p className="eyebrow">Selected Day</p>
              <h2>{formatFullDate(selectedDate)}</h2>
            </div>

            <div className="week-total">
              {status === "loading"
                ? "Loading..."
                : `${totalWeekEvents} events this week`}
            </div>
          </div>

          {status === "error" && (
            <div className="message error-message">
              {errorMessage}
            </div>
          )}

          {status === "loading" && (
            <div className="message loading-message">
              Loading GSC schedule...
            </div>
          )}

          {status === "ready" && selectedDay.error && (
            <div className="message warning-message">
              This day could not be loaded: {selectedDay.error}
            </div>
          )}

          {status === "ready" &&
            !selectedDay.error &&
            selectedDay.events.length === 0 && (
              <div className="message empty-message">
                No events scheduled for this day.
              </div>
            )}

          {status === "ready" && sortedEvents.length > 0 && (
            <div className="event-list">
              {sortedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}