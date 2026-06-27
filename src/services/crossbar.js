import { formatMonthDayYear, getWeekDates } from "../utils/dates";

const CLOUDFLARE_WORKER_PROXY =
  "https://gsc-calendar-proxy.amannino92.workers.dev/?path=";

function getProxyBase() {
  const hostname = window.location.hostname;

  // Local Vite development uses the proxy inside vite.config.js
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "/crossbar";
  }

  // GitHub Pages cannot run /api routes, so deployed GitHub Pages must use Cloudflare
  if (hostname.includes("github.io")) {
    return CLOUDFLARE_WORKER_PROXY;
  }

  // Optional: if you ever deploy to Vercel, this route would work there
  if (hostname.includes("vercel.app")) {
    return "/api/crossbar?path=";
  }

  // Default fallback for any other deployed host
  return CLOUDFLARE_WORKER_PROXY;
}

const PROXY_BASE = getProxyBase();

console.log("GSC calendar proxy base:", PROXY_BASE);

function buildProxyUrl(path) {
  if (PROXY_BASE.includes("?path=")) {
    return `${PROXY_BASE}${encodeURIComponent(path)}`;
  }

  return `${PROXY_BASE}${path}`;
}

function cleanText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDocumentFromHtml(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html");
}

function isTime(value) {
  return /^\d{1,2}:\d{2}\s*[AP]M$/i.test(cleanText(value));
}

function makeEvent({ date, teams, from, to, location, type = "Practice" }) {
  const cleanTeams = cleanText(teams);
  const cleanFrom = cleanText(from);
  const cleanTo = cleanText(to);
  const cleanLocation = cleanText(location);

  return {
    id: `${date}-${cleanTeams}-${cleanFrom}-${cleanTo}-${cleanLocation}`,
    date,
    from: cleanFrom,
    to: cleanTo,
    type,
    team: cleanTeams,
    opponent: "",
    title: cleanTeams || "Scheduled Event",
    location: cleanLocation || "TBD",
    sourceView: "club"
  };
}

/**
 * Primary parser:
 * Crossbar schedule rows usually render as a table:
 * Teams | From | To | Location
 */
function parseTableRows(doc, dateISO) {
  const events = [];
  const rows = Array.from(doc.querySelectorAll("tr"));

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll("td, th")).map((cell) =>
      cleanText(cell.textContent)
    );

    if (cells.length < 4) return;

    const joined = cells.join(" ").toLowerCase();

    if (
      joined.includes("teams from to location") ||
      joined.includes("from to type team opponent")
    ) {
      return;
    }

    // Club page format:
    // [Teams, From, To, Location]
    const [teams, from, to, location] = cells;

    if (isTime(from) && isTime(to)) {
      events.push(
        makeEvent({
          date: dateISO,
          teams,
          from,
          to,
          location,
          type: "Practice"
        })
      );

      return;
    }

    // Facility page possible format:
    // [From, To, Type, Team, Opponent]
    if (isTime(cells[0]) && isTime(cells[1])) {
      const eventType = cells[2] || "Event";
      const team = cells[3] || "Scheduled Event";
      const opponent = cells[4] || "";

      events.push({
        id: `${dateISO}-${cells.join("-")}`,
        date: dateISO,
        from: cleanText(cells[0]),
        to: cleanText(cells[1]),
        type: cleanText(eventType),
        team: cleanText(team),
        opponent: cleanText(opponent),
        title: opponent ? `${cleanText(team)} / ${cleanText(opponent)}` : cleanText(team),
        location: "Facility",
        sourceView: "facility"
      });
    }
  });

  return events;
}

/**
 * Fallback parser:
 * Handles cases where table rows are flattened into text.
 */
function parseTextRows(doc, dateISO) {
  const text = doc.body?.textContent || "";
  const normalized = text.replace(/\u00a0/g, " ");

  const expectedHeading = formatMonthDayYear(dateISO);

  if (!normalized.includes(expectedHeading)) {
    console.warn("Date heading not found in page text.", {
      dateISO,
      expectedHeading,
      preview: normalized.slice(0, 500)
    });

    return [];
  }

  const events = [];

  const rowRegex =
    /([A-Za-z0-9, '&/.-]+?)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+([A-Z][A-Z0-9 &'/-]+)/gi;

  let match;

  while ((match = rowRegex.exec(normalized)) !== null) {
    const [, teams, from, to, location] = match;

    const cleanedTeams = cleanText(teams);

    if (
      !cleanedTeams ||
      cleanedTeams.includes("Teams From To Location") ||
      cleanedTeams.includes("Practices")
    ) {
      continue;
    }

    events.push(
      makeEvent({
        date: dateISO,
        teams: cleanedTeams,
        from,
        to,
        location,
        type: "Practice"
      })
    );
  }

  return events;
}

function parseClubScheduleHtml(html, dateISO) {
  const doc = getDocumentFromHtml(html);

  let events = parseTableRows(doc, dateISO);

  if (events.length === 0) {
    events = parseTextRows(doc, dateISO);
  }

  console.log(`Parsed ${events.length} events for ${dateISO}`, events);

  return {
    date: dateISO,
    events,
    error: null
  };
}

export async function fetchCrossbarDay(dateISO) {
  const path = `/schedule/${dateISO}`;
  const url = buildProxyUrl(path);

  console.log("Fetching GSC schedule:", url);

  const response = await fetch(url, {
    headers: {
      Accept: "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`Crossbar returned ${response.status} for ${path}.`);
  }

  const html = await response.text();

  if (!html.includes("Greenwich Skating Club")) {
    console.warn("Fetched HTML does not look like the GSC page.", {
      dateISO,
      preview: html.slice(0, 500)
    });
  }

  return parseClubScheduleHtml(html, dateISO);
}

export async function fetchCrossbarWeek(startISO) {
  const dates = getWeekDates(startISO);

  const results = await Promise.all(
    dates.map(async (dateISO) => {
      try {
        return await fetchCrossbarDay(dateISO);
      } catch (error) {
        console.error(`Failed loading ${dateISO}:`, error);

        return {
          date: dateISO,
          events: [],
          error: error.message
        };
      }
    })
  );

  return results;
}