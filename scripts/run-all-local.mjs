import { spawn } from "node:child_process";
import { resolve } from "node:path";

const feeds = [
  {
    name: "acf",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1684,13928,13929,13930&type=6",
    outputFile: "public/acf-meta-feed.csv",
    mapFile: "public/url-map.json",
    reportFile: "public/feed-report.json",
    excludeVehicleIdsFile: "config/rangiora-vehicle-ids.txt"
  },
  {
    name: "rangiora",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1684,13928,13929,13930&type=6",
    outputFile: "public/rangiora-meta-feed.csv",
    mapFile: "public/rangiora-url-map.json",
    reportFile: "public/rangiora-feed-report.json",
    urlBranchId: "1077",
    customLabel1: "RANGIORA",
    includeVehicleIdsFile: "config/rangiora-vehicle-ids.txt"
  },
  {
    name: "best-ever-runout",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1684,13928,13929,13930&type=6",
    outputFile: "public/best-ever-runout-meta-feed.csv",
    mapFile: "public/best-ever-runout-url-map.json",
    reportFile: "public/best-ever-runout-feed-report.json",
    includeTitlePattern: "^(?:2025|2026) Ford (?:Everest\\b|Ranger .*\\b(?:Wildtrak|Platinum)\\b)"
  }
];

function run(script, env = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [resolve(script)], {
      stdio: "inherit",
      env: { ...process.env, ...env }
    });

    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script} failed with exit code ${code}.`));
    });
  });
}

await run("scripts/capture-inventory.mjs");

for (const feed of feeds) {
  console.log(`Generating ${feed.name} feed...`);
  await run("scripts/update-feed.mjs", {
    AUTOPLAY_FEED_URL: feed.autoplayUrl,
    ACF_SEARCH_FILE: "cache/acf-current.html",
    OUTPUT_FILE: feed.outputFile,
    MAP_FILE: feed.mapFile,
    REPORT_FILE: feed.reportFile,
    URL_BRANCH_ID: feed.urlBranchId || "",
    CUSTOM_LABEL_1: feed.customLabel1 || "",
    INCLUDE_TITLE_PATTERN: feed.includeTitlePattern || "",
    INCLUDE_VEHICLE_IDS_FILE: feed.includeVehicleIdsFile || "",
    EXCLUDE_VEHICLE_IDS_FILE: feed.excludeVehicleIdsFile || ""
  });
}
