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
    name: "yard-1684-used",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1684&type=6",
    outputFile: "public/yard-1684-used.csv",
    mapFile: "public/yard-1684-url-map.json",
    reportFile: "public/yard-1684-report.json"
  },
  {
    name: "yard-1685-new",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1685&type=6",
    outputFile: "public/yard-1685-new.csv",
    mapFile: "public/yard-1685-url-map.json",
    reportFile: "public/yard-1685-report.json",
    searchFile: "cache/acf-new-demo-current.html",
    matchTitleOnly: true
  },
  {
    name: "yard-1686-demo",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1686&type=6",
    outputFile: "public/yard-1686-demo.csv",
    mapFile: "public/yard-1686-url-map.json",
    reportFile: "public/yard-1686-report.json",
    searchFile: "cache/acf-new-demo-current.html",
    matchTitleOnly: true
  },
  {
    name: "yard-13928-used",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=13928&type=6",
    outputFile: "public/yard-13928-used.csv",
    mapFile: "public/yard-13928-url-map.json",
    reportFile: "public/yard-13928-report.json",
    urlBranchId: "1077"
  },
  {
    name: "yard-13929-demo",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=13929&type=6",
    outputFile: "public/yard-13929-demo.csv",
    mapFile: "public/yard-13929-url-map.json",
    reportFile: "public/yard-13929-report.json",
    searchFile: "cache/acf-new-demo-current.html",
    matchTitleOnly: true,
    urlBranchId: "1077"
  },
  {
    name: "yard-13930-new",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=13930&type=6",
    outputFile: "public/yard-13930-new.csv",
    mapFile: "public/yard-13930-url-map.json",
    reportFile: "public/yard-13930-report.json",
    searchFile: "cache/acf-new-demo-current.html",
    matchTitleOnly: true,
    urlBranchId: "1077",
    allowEmptySource: true
  },
  {
    name: "best-ever-runout",
    autoplayUrl: "http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1685,1686&type=6",
    outputFile: "public/best-ever-runout-meta-feed.csv",
    mapFile: "public/best-ever-runout-url-map.json",
    reportFile: "public/best-ever-runout-feed-report.json",
    searchFile: "cache/acf-new-demo-current.html",
    searchUrl: "https://www.avoncityford.com/vehicles/search?Condition=1",
    matchTitleOnly: true,
    requireSalePrice: true,
    includeYardPattern: "^New Cars$",
    includeTitlePattern: "^2026 Ford (?:Ranger Wildtrak .*Bi[ -]?Turbo|Everest Sport .*Bi[ -]?Turbo)"
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
    INCLUDE_YARD_PATTERN: feed.includeYardPattern || "",
    ALLOW_EMPTY_SOURCE: feed.allowEmptySource ? "1" : "",
    INCLUDE_VEHICLE_IDS_FILE: feed.includeVehicleIdsFile || "",
    EXCLUDE_VEHICLE_IDS_FILE: feed.excludeVehicleIdsFile || ""
  });
}

await run("scripts/combine-yard-feeds.mjs");
