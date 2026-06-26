const CROSSBAR_BASE = "https://www.greenwichskatingclub.org";

export default async function handler(req, res) {
  try {
    const rawPath = req.query.path;

    if (!rawPath || typeof rawPath !== "string") {
      return res.status(400).json({
        error: "Missing required path query parameter."
      });
    }

    const decodedPath = decodeURIComponent(rawPath);

    if (!decodedPath.startsWith("/schedule")) {
      return res.status(400).json({
        error: "Only /schedule routes are allowed."
      });
    }

    const upstreamUrl = new URL(decodedPath, CROSSBAR_BASE);

    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GSC_Calendar_Embed/1.0; +https://www.greenwichskatingclub.org)",
        Accept: "text/html"
      }
    });

    const html = await response.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=1800"
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.status(response.status).send(html);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Crossbar schedule.",
      details: error.message
    });
  }
}