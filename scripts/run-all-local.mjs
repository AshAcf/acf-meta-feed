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
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1685,1686&type=6",
    outputFile: "public/best-ever-runout-meta-feed.csv",
    mapFile: "public/best-ever-runout-url-map.json",
    reportFile: "public/best-ever-runout-feed-report.json",
    searchFile: "cache/acf-new-demo-current.html",
    searchUrl: "https://www.avoncityford.com/vehicles/search?Condition=1&Condition=2",
    matchTitleOnly: true,
    requireSalePrice: true,
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
await run("scripts/capture-inventory.mjs", {
  ACF_SEARCH_URL: "https://www.avoncityford.com/vehicles/search?Condition=1&Condition=2",
  ACF_BROWSER_OUTPUT: "cache/acf-new-demo-current.html",
  MIN_INVENTORY_CARDS: "20"
});

for (const feed of feeds) {
  console.log(`Generating ${feed.name} feed...`);
  await run("scripts/update-feed.mjs", {
    AUTOPLAY_FEED_URL: feed.autoplayUrl,
    ACF_SEARCH_URL: feed.searchUrl || "https://www.avoncityford.com/vehicles/search",
    ACF_SEARCH_FILE: feed.searchFile || "cache/acf-current.html",
    OUTPUT_FILE: feed.outputFile,
    MAP_FILE: feed.mapFile,
    REPORT_FILE: feed.reportFile,
    URL_BRANCH_ID: feed.urlBranchId || "",
    CUSTOM_LABEL_1: feed.customLabel1 || "",
    INCLUDE_TITLE_PATTERN: feed.includeTitlePattern || "",
    MATCH_TITLE_ONLY: feed.matchTitleOnly ? "1" : "",
    REQUIRE_SALE_PRICE: feed.requireSalePrice ? "1" : "",
    INCLUDE_VEHICLE_IDS_FILE: feed.includeVehicleIdsFile || "",
    EXCLUDE_VEHICLE_IDS_FILE: feed.excludeVehicleIdsFile || ""
  });
}
