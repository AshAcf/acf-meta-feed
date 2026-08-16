import { mkdir, readFile, writeFile } from "node:fs/promises";

const files = [
  "public/yard-1684-used.csv",
  "public/yard-1685-new.csv",
  "public/yard-1686-demo.csv",
  "public/yard-13928-used.csv",
  "public/yard-13929-demo.csv",
  "public/yard-13930-new.csv"
];

function rows(text) {
  const output = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { field += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(field); field = ""; }
    else if ((c === "\r" || c === "\n") && !quoted) {
      if (field || row.length) { row.push(field); output.push(row); row = []; field = ""; }
      if (c === "\r" && next === "\n") i += 1;
    } else field += c;
  }
  if (field || row.length) { row.push(field); output.push(row); }
  return output;
}

function cell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

const parsed = await Promise.all(files.map(async (file) => rows(await readFile(file, "utf8"))));
const headers = parsed[0][0];
const idIndex = headers.indexOf("vehicle_id");
const modelIndex = headers.indexOf("model");
const titleIndex = headers.indexOf("title");
const descriptionIndex = headers.indexOf("description");
const fuelTypeIndex = headers.indexOf("fueltype");
const imageIndex = headers.indexOf("image[0].url");
const seen = new Set();
const records = parsed.flatMap((table) => table.slice(1)).filter((record) => {
  const id = record[idIndex];
  if (!id || seen.has(id)) return false;
  seen.add(id);
  return true;
});
await writeFile("public/all-yards-meta-feed.csv", [headers, ...records].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n", "utf8");
await writeFile("public/all-yards-feed-report.json", JSON.stringify({ generated_at: new Date().toISOString(), source_files: files, published_vehicles: records.length }, null, 2) + "\n", "utf8");

function isHybrid(record) {
  const text = [record[modelIndex], record[titleIndex], record[descriptionIndex], record[fuelTypeIndex]].join(" ");
  return /\bPuma\b|\bEscape\b|Stormtrak|XLT.*Hybrid|Wildtrak.*Hybrid|Hybrid|MHEV|FHEV|PHEV|Plug[ -]?In/i.test(text);
}

const hybridRecords = records.filter(isHybrid);
await mkdir("public/images/hybrid-vehicles", { recursive: true });
const mirroredImages = await Promise.all(hybridRecords.map(async (record) => {
  const response = await fetch(record[imageIndex]);
  if (!response.ok) throw new Error(`Hybrid image request failed (${response.status}) for vehicle ${record[idIndex]}.`);
  await writeFile(`public/images/hybrid-vehicles/${record[idIndex]}.jpg`, Buffer.from(await response.arrayBuffer()));
  return record[idIndex];
}));

console.log(JSON.stringify({ combined_yards: files.length, published_vehicles: records.length, mirrored_hybrid_images: mirroredImages.length }, null, 2));
