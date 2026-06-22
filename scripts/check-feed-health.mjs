import { readFile } from "node:fs/promises";

const REPORT_FILE = process.env.REPORT_FILE || "public/feed-report.json";
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS || "10");
const MIN_MATCH_RATE = Number(process.env.MIN_MATCH_RATE || "0.9");

const report = JSON.parse(await readFile(REPORT_FILE, "utf8"));
const generatedAt = new Date(report.generated_at);
const ageHours = (Date.now() - generatedAt.getTime()) / 3600000;
const upstream = Number(report.upstream_vehicles || 0);
const published = Number(report.published_vehicles || 0);
const matchRate = Number.isFinite(Number(report.match_rate))
  ? Number(report.match_rate)
  : (upstream ? published / upstream : 0);

const summary = {
  generated_at: report.generated_at,
  age_hours: Number(ageHours.toFixed(2)),
  upstream_vehicles: upstream,
  published_vehicles: published,
  match_rate: Number((matchRate * 100).toFixed(2)) + "%",
  unmatched_vehicle_ids: (report.unmatched || []).map((vehicle) => vehicle.vehicle_id)
};

console.log(JSON.stringify(summary, null, 2));

if (!Number.isFinite(generatedAt.getTime())) {
  throw new Error("Feed report has no valid generated_at date.");
}
if (ageHours < -1) {
  throw new Error("Feed report date is unexpectedly in the future.");
}
if (ageHours > MAX_AGE_HOURS) {
  throw new Error(`Feed is ${ageHours.toFixed(1)} hours old; maximum is ${MAX_AGE_HOURS} hours.`);
}
if (!upstream || !published) {
  throw new Error("Feed report contains no vehicle totals.");
}
if (matchRate < MIN_MATCH_RATE) {
  throw new Error(`Feed match rate is ${(matchRate * 100).toFixed(1)}%; minimum is ${(MIN_MATCH_RATE * 100).toFixed(1)}%.`);
}
