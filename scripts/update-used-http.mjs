// Refresh the two primary feeds independently of the local browser capture.
// Uses server-rendered inventory and exact title/odometer matching.
import {mkdtemp,readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const working = await mkdtemp(join(tmpdir(),'acf-used-refresh-'));
const source = 'https://www.avoncityford.com/vehicles/search';
const response = await fetch(source,{headers:{accept:'text/html'},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error(`Inventory HTTP ${response.status}`);
const html=await response.text();
const count=[...html.matchAll(/<article\b[^>]*class=["'][^"']*\bgw-product-card\b/gi)].length;
if(count<40)throw new Error(`Only ${count} inventory cards; previous feeds preserved.`);
const searchFile=join(working,'inventory.html');await writeFile(searchFile,html);
const files=[];
for(const config of [
 {csv:'acf-meta-feed.csv',map:'url-map.json',report:'feed-report.json',yards:'1684,13928,13929,13930',env:{EXCLUDE_VEHICLE_IDS_FILE:'config/rangiora-vehicle-ids.txt'}},
 {csv:'rangiora-meta-feed.csv',map:'rangiora-url-map.json',report:'rangiora-feed-report.json',yards:'13928,13929,13930',env:{URL_BRANCH_ID:'1077',CUSTOM_LABEL_1:'RANGIORA'}}
]){
 const result=spawnSync(process.execPath,['scripts/update-feed.mjs'],{stdio:'inherit',timeout:120000,env:{...process.env,
  AUTOPLAY_FEED_URL:`https://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=${config.yards}&type=6`,
  ACF_SEARCH_URL:source,ACF_SEARCH_FILE:searchFile,AUTOPLAY_FEED_FILE:'',
  OUTPUT_FILE:join(working,config.csv),MAP_FILE:join(working,config.map),REPORT_FILE:join(working,config.report),
  URL_BRANCH_ID:'',CUSTOM_LABEL_1:'',INCLUDE_VEHICLE_IDS_FILE:'',EXCLUDE_VEHICLE_IDS_FILE:'',
  INCLUDE_TITLE_PATTERN:'',INCLUDE_YARD_PATTERN:'',MATCH_TITLE_ONLY:'',REQUIRE_SALE_PRICE:'',ALLOW_EMPTY_SOURCE:'',
  MIN_INVENTORY_CARDS:'40',MIN_FEED_MATCH_RATE:'0.9',...config.env
 }});
 if(result.error || result.status!==0)throw new Error(`${config.csv} generation failed; previous feeds preserved. ${result.error?.message || ''}`);
 const report=JSON.parse(await readFile(join(working,config.report),'utf8'));
 if(!report.published_vehicles || report.match_rate<.9)throw new Error('Generated feed failed validation');
 files.push(config.csv,config.map,config.report);
}
// Publish local outputs only once BOTH feeds have passed their safety checks.
await mkdir('public',{recursive:true});
for(const file of files)await copyFile(join(working,file),join('public',file));
console.log(`Refreshed both primary feeds from ${count} live inventory cards.`);
