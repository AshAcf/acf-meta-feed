# Website inventory and Wolftrak

Website CSV: https://raw.githubusercontent.com/AshAcf/acf-meta-feed/main/public/acf-vehicle-feed.csv

Report: https://raw.githubusercontent.com/AshAcf/acf-meta-feed/main/public/acf-vehicle-feed-report.json

The independent `Update website inventory feed` GitHub Action runs every three hours, on relevant source updates, and manually. It runs tests and publishes only the two website outputs. Existing Meta scripts, files, and monitoring are unchanged.

Sources: the published Sockburn and Rangiora feeds, plus the live AutoPlay Sockburn new/demo endpoint with yardList=1685,1686&type=6. Rangiora overrides duplicate used-feed IDs; fresh Sockburn new/demo data overrides those records. IDs and stock numbers stay strings. AutoPlay vehicle_id is used as stock_number when a separate stock number is absent. Prices are plain decimal NZD values; blank sale_price means no sale price. Yard codes are SOCKBURN/RANGIORA; source_yardname retains AutoPlay's label. Demo Cars becomes DEMO even when AutoPlay's Meta condition says USED.

AutoPlay's old /used-car-detail?id=... paths do not become valid just by replacing the domain. New/demo URLs use the existing yard-1685/1686 URL maps, and exact Avon City Ford hostnames are normalized to https://www.avoncityford.com. Unmapped legacy URLs are omitted and listed in the report. Below 90% mapped new/demo coverage, malformed/empty sources, or used-feed reports older than 24 hours cause a failed run and preserve the previous published output. Check the report's generated_at before relying on feed freshness.

The existing Windows updater still supplies used inventory and URL maps. This Action does not replace that browser-based process. New stock without a map needs the existing yard-map capture refreshed and committed. At initial validation, 62 of 65 new/demo vehicles were mapped; three Everest Tremors were omitted. All four Wolftraks were included. Existing URL mappings are reused, not newly verified against individual vehicle identity.

## Wolftrak landing page change

Replace the used-only/runout CSV source with the website CSV above. Parse it with the page's CSV parser (do not split on commas). Filter case-insensitively for model Ranger and Wolftrak in variant/title. If showing only Sockburn new/demo stock, also require yard_code SOCKBURN and state_of_vehicle NEW or DEMO.

```js
const wolftraks = rows.filter(r =>
  /\branger\b/i.test(r.model) &&
  /\bwolftrak\b/i.test(`${r.variant} ${r.title}`) &&
  r.yard_code === 'SOCKBURN' &&
  ['NEW', 'DEMO'].includes(r.state_of_vehicle)
);
const displayPrice = r => {
  const price = Number(r.price), sale = Number(r.sale_price);
  return sale > 0 && (!price || sale < price) ? sale : price;
};
```

Use vehicle_id as the card key, image[0].url for the image, URL for the vehicle link, and exterior_color for colour. Render feed text through textContent/framework escaping. Show a deliberate empty-stock state and a separate load-failure state. Do not filter custom_label_0=SALE or hard-code vehicle IDs. The landing page source is outside this repository and has not been edited.

Run locally: `node --test scripts/test-website-feed.mjs`, then `node scripts/update-website-feed.mjs`. WEBSITE_SOURCE_FILE can point to a saved AutoPlay CSV for repeatable validation.
