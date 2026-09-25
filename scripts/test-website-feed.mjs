import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csv, normalize, listingUrl } from './update-website-feed.mjs';

const row = { vehicle_id: '00123', year: '2026', make: 'Ford', model: 'Ranger',
  title: '2026 Ford Ranger Wolftrak "V6", 4WD\nSpecial', yardname: 'Demo Cars',
  state_of_vehicle: 'USED', price: '75,990 NZD', sale_price: '69990 NZD',
  URL: 'http://avoncityford.co.nz/vehicles/stock/123/1002/ford-ranger',
  'image[0].url': 'https://dataapi.autoplay.co.nz/image.ashx?id=1' };
test('CSV preserves quoted commas, newlines, quotes and leading zero IDs', () => {
  const output = normalize(row, 'SOCKBURN');
  assert.deepEqual(parseCsv('\uFEFF' + csv([output])), [output]);
});
test('demo condition comes from yard; retain source yard and normalize prices', () => {
  const r = normalize(row, 'SOCKBURN');
  assert.equal(r.state_of_vehicle, 'DEMO'); assert.equal(r.source_yardname, 'Demo Cars');
  assert.equal(r.yardname, 'Sockburn'); assert.equal(r.price, '75990');
  assert.equal(r.sale_price, '69990'); assert.equal(r.stock_number, '00123');
  assert.match(r.variant, /^Wolftrak/);
});
test('only exact Avon City Ford hosts are rewritten', () => {
  assert.equal(listingUrl(row.URL), 'https://www.avoncityford.com/vehicles/stock/123/1002/ford-ranger');
  assert.throws(() => listingUrl('https://avoncityford.co.nz.evil.test/vehicles/stock/1/2/a'));
  assert.throws(() => listingUrl('https://www.avoncityford.co.nz/used-car-detail?id=1'));
});
test('mapped current URL replaces obsolete listing path', () => {
  const r = normalize({ ...row, URL: 'https://www.avoncityford.co.nz/used-car-detail?id=1' }, 'SOCKBURN', { '00123': row.URL });
  assert.match(r.URL, /^https:\/\/www.avoncityford.com\/vehicles\/stock\//);
});
test('malformed CSV and prices fail closed', () => {
  assert.throws(() => parseCsv('<html>Error</html>'));
  assert.throws(() => parseCsv(csv([normalize(row, 'SOCKBURN')]) + '"unfinished'));
  assert.throws(() => normalize({ ...row, price: 'POA' }, 'SOCKBURN'));
});
