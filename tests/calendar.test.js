import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthsAhead,normalizeDate,groupEvents,readEvents,daysFromToday,dayOffsetLabel} from '../src/calendar.js';
test('day offsets count calendar days across daylight saving and year boundaries',()=>{
 assert.equal(daysFromToday(new Date(2027,2,15),new Date(2027,2,13,23,59)),2);
 assert.equal(daysFromToday(new Date(2027,0,1),new Date(2026,11,31,23)),1);
 assert.equal(dayOffsetLabel(new Date(2026,9,7),new Date(2026,9,7,23)),'Today · 0 days from today');
 assert.equal(dayOffsetLabel(new Date(2026,9,6),new Date(2026,9,7)),'1 day ago');
 assert.equal(dayOffsetLabel(new Date(2026,9,9),new Date(2026,9,7)),'2 days from today');
});
test('requested range includes all fifteen months through December 2027',()=>{
 const months=monthsAhead(new Date(2026,9,1),15);assert.equal(months.length,15);assert.equal(months[0].year,2026);assert.equal(months.at(-1).year,2027);assert.equal(months.at(-1).label,'Dec');
});
test('twelve months cross the year and include leap day',()=>{
 const months=monthsAhead(new Date(2027,9,7));assert.equal(months.length,12);assert.equal(months[0].label,'Oct');assert.equal(months.at(-1).label,'Sep');assert.equal(months.at(-1).year,2028);assert.equal(months[4].days.length,29);
});
test('DayFlow unpadded dates match database dates; invalid dates are excluded',()=>{
 assert.equal(normalizeDate('2026-10-7'),'2026-10-07');assert.equal(normalizeDate('2026-2-30'),null);
 const groups=groupEvents([{title:'Timed',date:'2026-10-7',time:'09:00'},{title:'All day',date:'2026-10-07'},{title:'Inbox',date:null}]);assert.deepEqual(groups.get('2026-10-07').map(t=>t.title),['All day','Timed']);assert.equal(groups.size,1);
});
test('loads beyond API page limit and uses an exclusive month boundary',async()=>{
 const calls=[],client={from(){const q={select(){return q},eq(){return q},gte(){return q},lt(k,v){calls.push(v);return q},order(){return q},async range(from,to){assert.equal(to-from,499);return {data:Array.from({length:from===0?500:3},()=>({title:'Event'})),error:null}}};return q}};
 assert.equal((await readEvents(client,'user',monthsAhead(new Date(2026,9,7)))).length,503);assert.deepEqual(calls,['2027-10-01','2027-10-01']);
});
