import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const AUTOPLAY_FEED_URL = process.env.AUTOPLAY_FEED_URL ||
  "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1684&type=6";
const ACF_SEARCH_URL = process.env.ACF_SEARCH_URL ||
  "https://www.avoncityford.com/vehicles/search";
const AUTOPLAY_FEED_FILE = process.env.AUTOPLAY_FEED_FILE || "";
const ACF_SEARCH_FILE = process.env.ACF_SEARCH_FILE || "";
const OUTPUT_FILE = resolve(process.env.OUTPUT_FILE || "public/acf-meta-feed.csv");
const MAP_FILE = resolve(process.env.MAP_FILE || "public/url-map.json");
const REPORT_FILE = resolve(process.env.REPORT_FILE || "public/feed-report.json");
const MIN_INVENTORY_CARDS = Number(process.env.MIN_INVENTORY_CARDS || "40");
const MIN_FEED_MATCH_RATE = Number(process.env.MIN_FEED_MATCH_RATE || "0.9");
const USER_AGENT = "AvonCityFordFeedUpdater/1.0 (+https://www.avoncityford.com)";

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\r" || character === "\n") && !quoted) {
      if (field || row.length) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
      if (character === "\r" && next === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) throw new Error("Autoplay returned an empty feed.");

  const headers = rows.shift().map((header) => header.trim());
  return {
    headers,
    records: rows
      .filter((values) => values.some((value) => value !== ""))
      .map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] || ""])))
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function writeCsv(headers, records) {
  return [
    headers.map(csvCell).join(","),
    ...records.map((record) => headers.map((header) => csvCell(record[header])).join(","))
  ].join("\r\n") + "\r\n";
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function fetchText(url, attempt = 1) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "accept": "text/html,text/csv;q=0.9,*/*;q=0.8",
      "user-agent": USER_AGENT
    }
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30000, 1500 * (2 ** (attempt - 1)));
    await wait(delay);
    return fetchText(url, attempt + 1);
  }

  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  return response.text();
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normaliseTitle(value) {
  return stripTags(value)
    .toLowerCase()
    .replace(/\bon sale\b|\bsale\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mileageValue(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function inventoryCards(html) {
  const cards = [];
  const matches = html.matchAll(/<article class=["'][^"']*gw-product-card[^"']*["']>([\s\S]*?)<\/article>/gi);

  for (const match of matches) {
    const body = match[1];
    const heading = body.match(/<h3[^>]*class=["'][^"']*gw-card__title[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const specs = body.match(/<div[^>]*class=["'][^"']*gw-product-card__specs[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    if (!heading) continue;

    const specsText = stripTags(specs);
    const year = specsText.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || "";
    const mileage = specsText.match(/([\d,]+)\s*KM\b/i)?.[1] || "";
    const title = `${year} ${stripTags(heading[2])}`.trim();

    cards.push({
      key: `${normaliseTitle(title)}|${mileageValue(mileage)}`,
      title,
      mileage: mileageValue(mileage),
      url: new URL(decodeHtml(heading[1]), ACF_SEARCH_URL).href
    });
  }

  return cards;
}

async function readSource(file, url) {
  return file ? readFile(resolve(file), "utf8") : fetchText(url);
}

async function main() {
  const [feedText, searchHtml] = await Promise.all([
    readSource(AUTOPLAY_FEED_FILE, AUTOPLAY_FEED_URL),
    readSource(ACF_SEARCH_FILE, ACF_SEARCH_URL)
  ]);

  const { headers, records } = parseCsv(feedText);
  if (!headers.includes("vehicle_id") || !headers.includes("URL")) {
    throw new Error("Feed must contain vehicle_id and URL columns.");
  }

  const inventory = inventoryCards(searchHtml);
  if (inventory.length < MIN_INVENTORY_CARDS) {
    throw new Error(`Only ${inventory.length} ACF inventory cards were found; minimum is ${MIN_INVENTORY_CARDS}. Last good feed was preserved.`);
  }

  const byKey = new Map();
  for (const vehicle of inventory) {
    if (!byKey.has(vehicle.key)) byKey.set(vehicle.key, []);
    byKey.get(vehicle.key).push(vehicle);
  }

  const unmatched = [];
  const urlMap = {};

  const corrected = records.flatMap((record) => {
    const reference = String(record.vehicle_id || "").trim();
    const title = record.title || record.description || "";
    const key = `${normaliseTitle(title)}|${mileageValue(record["mileage.value"])}`;
    const candidates = byKey.get(key) || [];
    const url = candidates.length === 1 ? candidates[0].url : "";

    if (!url) {
      unmatched.push({
        vehicle_id: reference,
        title,
        mileage: record["mileage.value"] || "",
        original_url: record.URL || "",
        candidate_count: candidates.length
      });
      return [];
    }

    urlMap[reference] = url;
    return [{ ...record, URL: url }];
  });

  if (!corrected.length) throw new Error("No Autoplay vehicles matched the live ACF inventory. Last good feed was preserved.");
  const matchRate = records.length ? corrected.length / records.length : 0;
  if (matchRate < MIN_FEED_MATCH_RATE) {
    throw new Error(`Matched ${(matchRate * 100).toFixed(1)}% of the Autoplay feed; minimum is ${(MIN_FEED_MATCH_RATE * 100).toFixed(1)}%. Last good feed was preserved.`);
  }

  const generatedAt = new Date().toISOString();
  const report = {
    generated_at: generatedAt,
    upstream_feed: AUTOPLAY_FEED_URL,
    acf_inventory_url: ACF_SEARCH_URL,
    upstream_vehicles: records.length,
    published_vehicles: corrected.length,
    match_rate: matchRate,
    matched_by_title_and_mileage: corrected.length,
    unmatched,
    inventory_cards_found: inventory.length
  };

  await Promise.all([
    mkdir(dirname(OUTPUT_FILE), { recursive: true }),
    mkdir(dirname(MAP_FILE), { recursive: true }),
    mkdir(dirname(REPORT_FILE), { recursive: true })
  ]);

  await Promise.all([
    writeFile(OUTPUT_FILE, writeCsv(headers, corrected), "utf8"),
    writeFile(MAP_FILE, JSON.stringify(urlMap, null, 2) + "\n", "utf8"),
    writeFile(REPORT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8")
  ]);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
