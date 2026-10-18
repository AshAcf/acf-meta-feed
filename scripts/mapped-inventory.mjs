export function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw new Error('Incomplete source CSV');
 row.push(field);if(row.some(Boolean))rows.push(row);
 const headers=(rows.shift()||[]).map(h=>h.replace(/^\uFEFF/,''));
 if(!headers.includes('vehicle_id')||!headers.includes('URL'))throw new Error('Invalid source CSV');
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}
const normal=s=>String(s||'').toLowerCase().replace(/\bon sale\b|\bsale\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mappedRecords(current,previous,mappings){
 const old=new Map(previous.map(r=>[r.vehicle_id,r]));
 return current.flatMap(r=>{
  const prior=old.get(r.vehicle_id),link=mappings[r.vehicle_id];
  if(!prior||!link)return [];
  if(['year','make','model','title'].some(k=>normal(r[k])!==normal(prior[k])))return [];
  let u;try{u=new URL(link);}catch{return [];}
  if(u.protocol!=='https:'||!['www.avoncityford.com','avoncityford.com'].includes(u.hostname)||!/^\/vehicles\/stock\/\d+\/(1002|1077)\//.test(u.pathname))return [];
  return [{...r,URL:u.href}];
 });
}
export function matchingHTML(records){
 return records.map(r=>{
  const title=String(r.title||r.description||'').replace(new RegExp('^'+r.year+'\\s+'),'');
  return `<article class="gw-product-card"><h3 class="gw-card__title"><a href="${esc(r.URL)}">${esc(title)}</a></h3><div class="gw-product-card__specs">${esc(r.year)} ${esc(r['mileage.value'])} KM</div></article>`;
 }).join('\n');
}
