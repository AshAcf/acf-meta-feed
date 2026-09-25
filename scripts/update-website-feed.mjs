import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE = 'http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1685,1686&type=6';
export const HEADERS = ['vehicle_id', 'stock_number', 'state_of_vehicle', 'yardname', 'yard_code', 'source_yardname', 'year', 'make', 'model', 'variant', 'title', 'price', 'sale_price', 'currency', 'image[0].url', 'URL', 'exterior_color', 'mileage.value'];

export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\r' || c === '\n') && !quoted) {
      if (field || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift()?.map(x => x.trim()) || [];
  for (const name of ['vehicle_id', 'title', 'make', 'model', 'URL', 'price', 'yardname']) {
    if (!headers.includes(name)) throw new Error(`Missing CSV column: ${name}`);
  }
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV columns');
  return rows.map(values => {
    if (values.length !== headers.length) throw new Error('Invalid CSV row width');
    return Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
  });
}

export function csv(records) {
  const cell = x => '"' + String(x ?? '').replaceAll('"', '""') + '"';
  return [HEADERS, ...records.map(r => HEADERS.map(h => r[h]))].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function listingUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !['avoncityford.co.nz', 'www.avoncityford.co.nz', 'avoncityford.com', 'www.avoncityford.com'].includes(url.hostname)) {
    throw new Error('Unexpected listing URL');
  }
  url.protocol = 'https:'; url.host = 'www.avoncityford.com';
  // AutoPlay's used-car-detail path is obsolete on the .com site.
  if (!/^\/vehicles\/stock\/\d+\/\d+\//.test(url.pathname)) throw new Error('Listing needs a current URL map');
  return url.href;
}

function money(value) {
  const text = String(value || '').replace(/\s*NZD\s*$/i, '').replace(/[$,\s]/g, '');
  if (!text) return '';
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error(`Invalid NZD price: ${value}`);
  return String(Number(text));
}

export function normalize(r, branch, maps = {}) {
  const title = r.title.trim();
  const state = /demo/i.test(r.yardname) ? 'DEMO' : /new/i.test(r.yardname) ? 'NEW' : r.state_of_vehicle?.toUpperCase();
  if (!r.vehicle_id || !title || !r.make || !r.model || !['NEW', 'DEMO', 'USED'].includes(state)) throw new Error('Invalid vehicle identity or condition');
  const image = new URL(r['image[0].url']);
  if (!['http:', 'https:'].includes(image.protocol)) throw new Error('Invalid image URL');
  const prefix = [r.year, r.make, r.model].filter(Boolean).join(' ');
  return {
    vehicle_id: r.vehicle_id, stock_number: r.stock_number || r.vehicle_id,
    state_of_vehicle: state, yardname: branch === 'RANGIORA' ? 'Rangiora' : 'Sockburn',
    yard_code: branch, source_yardname: r.yardname,
    year: r.year || '', make: r.make, model: r.model,
    variant: r.variant || (title.toLowerCase().startsWith(prefix.toLowerCase() + ' ') ? title.slice(prefix.length).trim() : ''),
    title, price: money(r.price), sale_price: money(r.sale_price), currency: 'NZD',
    'image[0].url': image.href, URL: listingUrl(maps[r.vehicle_id] || r.URL),
    exterior_color: r.exterior_color || '', 'mileage.value': r['mileage.value'] || ''
  };
}

export async function main() {
  const read = file => readFile(file, 'utf8');
  const [acf, rangiora, live, maps, reports] = await Promise.all([
    read('public/acf-meta-feed.csv'), read('public/rangiora-meta-feed.csv'),
    process.env.WEBSITE_SOURCE_FILE ? read(process.env.WEBSITE_SOURCE_FILE) : fetchSource(),
    Promise.all(['1685', '1686'].map(async id => JSON.parse(await read(`public/yard-${id}-url-map.json`)))),
    Promise.all(['feed-report', 'rangiora-feed-report'].map(async name => JSON.parse(await read(`public/${name}.json`))))
  ]);
  for (const r of reports) {
    const age = Date.now() - Date.parse(r.generated_at);
    if (!Number.isFinite(age) || age < -300000 || age > 24 * 3600000) throw new Error('Used inventory is older than 24 hours; preserving last good website feed');
  }
  const fresh = parseCsv(live);
  if (!fresh.length) throw new Error('Empty new/demo source; preserving last good website feed');
  const map = Object.assign({}, ...maps), unresolved = [], seen = new Map();
  // Rangiora wins any overlap with the older Sockburn used feed.
  for (const [text, branch] of [[acf, 'SOCKBURN'], [rangiora, 'RANGIORA']]) {
    for (const r of parseCsv(text)) seen.set(r.vehicle_id, normalize(r, branch));
  }
  let matched = 0;
  for (const r of fresh) {
    if (!/^(New|Demo) Cars$/i.test(r.yardname)) throw new Error(`Unexpected new/demo yard: ${r.yardname}`);
    let normalized;
    try { normalized = normalize(r, 'SOCKBURN', map); }
    catch (e) {
      if (e.message !== 'Listing needs a current URL map') throw e;
      unresolved.push({ vehicle_id: r.vehicle_id, title: r.title });
      continue;
    }
    matched++;
    seen.set(r.vehicle_id, normalized);
  }
  if (matched / fresh.length < 0.9) throw new Error(`Only ${matched}/${fresh.length} new/demo vehicles have current listing URLs; preserving last good feed`);
  const records = [...seen.values()].sort((a, b) => a.vehicle_id.localeCompare(b.vehicle_id));
  const output = csv(records);
  if (parseCsv(output).length !== records.length) throw new Error('CSV round-trip failed');
  const report = {
    generated_at: new Date().toISOString(), upstream_feed: SOURCE,
    used_source_generated_at: reports.map(r => r.generated_at),
    published_vehicles: records.length, new_demo_source_vehicles: fresh.length,
    new_demo_published_vehicles: matched, unresolved,
    wolftrak_vehicles: records.filter(r => /\branger\b/i.test(r.model) && /\bwolftrak\b/i.test(r.title)).length
  };
  await mkdir('public', { recursive: true });
  await writeFile('public/acf-vehicle-feed.csv.tmp', output);
  await rename('public/acf-vehicle-feed.csv.tmp', 'public/acf-vehicle-feed.csv');
  await writeFile('public/acf-vehicle-feed-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

async function fetchSource() {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(SOURCE, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`AutoPlay HTTP ${response.status}`);
      return await response.text();
    } catch (e) { error = e; }
  }
  throw error;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e => { console.error(e); process.exitCode = 1; });
}
