import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  formatDayTab,
  formatFullDate,
  getWeekDates,
  startOfWeekMonday,
  todayISO
} from "./utils/dates";
import { fetchCrossbarWeek } from "./services/crossbar";

function getInitialDate() {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam || "")) {
    return dateParam;
  }

  return todayISO();
}

function groupEventsByLocation(events) {
  return events.reduce((groups, event) => {
    const location = event.location || "TBD";

    if (!groups[location]) {
      groups[location] = [];
    }

    groups[location].push(event);

    return groups;
  }, {});
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
  const [viewMode, setViewMode] = useState(
    import.meta.env.VITE_DEFAULT_VIEW || "facility"
  );
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

  const groupedEvents = useMemo(() => {
    return groupEventsByLocation(selectedDay.events || []);
  }, [selectedDay]);

  const totalWeekEvents = useMemo(() => {
    return days.reduce((total, day) => total + day.events.length, 0);
  }, [days]);

  useEffect(() => {
    let isMounted = true;

    async function loadSchedule() {
      setStatus("loading");
      setErrorMessage("");

      try {
        const results = await fetchCrossbarWeek(weekStart, viewMode);

        if (!isMounted) return;

        setDays(results);

        const failedDays = results.filter((day) => day.error);

        if (failedDays.length === results.length) {
          setStatus("error");
          setErrorMessage(
            "Could not load the Crossbar schedule. Check your proxy settings."
          );
        } else {
          setStatus("ready");
        }
      } catch (error) {
        if (!isMounted) return;

        setStatus("error");
        setErrorMessage(error.message);
      }
    }

    loadSchedule();

    return () => {
      isMounted = false;
    };
  }, [weekStart, viewMode]);

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
            <p className="header-subtitle">
              Live schedule pulled from the public Crossbar schedule pages.
            </p>
          </div>

          <div className="view-toggle" aria-label="Schedule view selector">
            <button
              type="button"
              className={viewMode === "facility" ? "active" : ""}
              onClick={() => setViewMode("facility")}
            >
              Facility
            </button>
            <button
              type="button"
              className={viewMode === "club" ? "active" : ""}
              onClick={() => setViewMode("club")}
            >
              Club
            </button>
          </div>
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

          {status === "ready" &&
            Object.entries(groupedEvents).map(([location, events]) => (
              <section className="location-group" key={location}>
                <div className="location-heading">
                  <h3>{location}</h3>
                  <span>
                    {events.length === 1
                      ? "1 event"
                      : `${events.length} events`}
                  </span>
                </div>

                <div className="event-list">
                  {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            ))}
        </section>
      </section>
    </main>
  );
}