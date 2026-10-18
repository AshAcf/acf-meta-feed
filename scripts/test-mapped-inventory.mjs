import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mappedRecords,matchingHTML,parseCSV} from './mapped-inventory.mjs';
const vehicle={vehicle_id:'001',year:'2024',make:'Ford',model:'Ranger',title:'2024 Ford Ranger Wildtrak','mileage.value':'25000',URL:'https://www.avoncityford.com/vehicles/stock/123/1002/ford-ranger'};
test('only live stock with unchanged identity and known URLs is refreshed',()=>{
 const live=[{...vehicle,'mileage.value':'26000'},{...vehicle,vehicle_id:'new-stock'}];
 const result=mappedRecords(live,[vehicle],{'001':vehicle.URL});
 assert.equal(result.length,1);assert.equal(result[0]['mileage.value'],'26000');
 assert.equal(mappedRecords([{...vehicle,year:'2025'}],[vehicle],{'001':vehicle.URL}).length,0);
 assert.equal(mappedRecords([{...vehicle,title:'2024 Ford Ranger Platinum'}],[vehicle],{'001':vehicle.URL}).length,0);
 assert.equal(mappedRecords(live,[vehicle],{'001':'https://example.com/car'}).length,0);
});
test('synthetic matching input encodes text and keeps an exact year/title key',()=>{
 const html=matchingHTML([vehicle]);assert(html.includes('2024 25000 KM'));assert(html.includes('>Ford Ranger Wildtrak</a>'));
});
test('CSV quoted commas and leading-zero IDs remain intact',()=>{
 const parsed=parseCSV('vehicle_id,URL,title\r\n001,https://example.com,"A, B"');assert.equal(parsed[0].vehicle_id,'001');assert.equal(parsed[0].title,'A, B');
});
