import {test,expect} from '@playwright/test';
test('compact fifteen month rows show events only in a hover box, with keyboard and touch support',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.month')).toHaveCount(15);await expect(page.locator('#range')).toHaveText("Oct. '26 – Dec. '27");
 expect(await page.locator('.month').evaluateAll(rows=>rows.slice(0,3).map(r=>r.querySelectorAll('.day').length))).toEqual([31,30,31]);
 expect(await page.locator('.month').evaluateAll(rows=>rows.slice(0,-1).map((r,i)=>({i,margin:parseFloat(getComputedStyle(r).marginBottom)})).filter(r=>r.margin))).toEqual([2,5,8,11].map(i=>({i,margin:52})));
 const tasks=Array.from({length:15},(_,i)=>({title:i===0?'<script>alert(1)</script>':`Appointment ${i}`,date:'2026-10-7',time:'09:00',notes:'Some details'}));
 await page.locator('#import').setInputFiles({name:'dayflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({tasks}))});
 await expect(page.locator('#date-events')).toBeHidden();await expect(page.locator('#calendar .event')).toHaveCount(0);
 const date=page.locator('[data-date="2026-10-07"]');await date.hover();await expect(page.locator('#date-events')).toBeVisible();await expect(page.locator('.event')).toHaveCount(15);await expect(page.locator('.event').first()).toContainText('<script>alert(1)</script>');
 expect(await page.locator('.month').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(35);
 await page.screenshot({path:'test-results/bigcal-hover.png'});await page.mouse.move(5,5);await expect(page.locator('#date-events')).toBeHidden();
 await date.focus();await expect(page.locator('#date-events')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#date-events')).toBeHidden();
 await page.screenshot({path:'test-results/bigcal-compact.png'});await page.setViewportSize({width:390,height:844});await date.click();await expect(page.locator('#date-events')).toBeVisible();
 const box=await page.locator('#date-events').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);expect(errors).toEqual([]);
});

test('signed-in DayFlow events load for October 2026 and December 2027',async({page})=>{
 const user={id:'12345678-1234-1234-1234-123456789012',aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 await page.addInitScript(({user})=>{
   localStorage.setItem('bigcal-auth',JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
   localStorage.setItem('bigcal-auth-deadline',String(Date.now()+90*86400000));
 },{user});
 let reads=0;
 await page.route('**/rest/v1/tasks?**',async route=>{
   const url=new URL(route.request().url());expect(url.searchParams.getAll('date')).toEqual(['gte.2026-10-01','lt.2028-01-01']);expect(url.searchParams.get('user_id')).toBe(`eq.${user.id}`);reads++;
   await route.fulfill({json:[{id:'one',title:'October DayFlow appointment',date:'2026-10-07',start_time:'09:00:00',notes:''},{id:'two',title:'December DayFlow appointment',date:'2027-12-31',start_time:null,notes:''}]});
 });
 await page.goto('/');await expect(page.locator('#account')).toHaveText('Sign out');await expect(page.locator('#status')).toBeHidden();
 await page.locator('[data-date="2026-10-07"]').hover();await expect(page.locator('#date-events')).toContainText('October DayFlow appointment');
 await page.locator('[data-date="2027-12-31"]').hover();await expect(page.locator('#date-events')).toContainText('December DayFlow appointment');
 await page.reload();await expect(page.locator('#account')).toHaveText('Sign out');await page.locator('[data-date="2026-10-07"]').hover();await expect(page.locator('#date-events')).toContainText('October DayFlow appointment');expect(reads).toBeGreaterThanOrEqual(2);
});

test('search highlights matching dates and filters hover events by title or notes',async({page})=>{
 await page.goto('/');await page.locator('#import').setInputFiles({name:'events.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({tasks:[{title:'Dentist',notes:'Bring insurance',date:'2026-10-07'},{title:'Lunch',date:'2026-10-07'},{title:'DENTIST follow-up',date:'2027-12-31'}]}))});
 await expect(page.locator('#status')).toBeHidden();await expect(page.locator('.hint')).toHaveCount(0);
 await page.locator('#search').fill('dentist');await expect(page.locator('.search-match')).toHaveCount(2);await expect(page.locator('#search-status')).toHaveText('2 matching events');
 await page.locator('[data-date="2026-10-07"]').hover();await expect(page.locator('#date-events')).toContainText('Dentist');await expect(page.locator('#date-events')).not.toContainText('Lunch');
 await page.locator('#search').fill('insurance');await expect(page.locator('.search-match')).toHaveCount(1);
 await page.locator('#search').fill('no-such-event');await expect(page.locator('#search-status')).toHaveText('0 matching events');
 await page.locator('#search').fill('');await expect(page.locator('.search-dim')).toHaveCount(0);await page.locator('[data-date="2026-10-07"]').hover();await expect(page.locator('#date-events')).toContainText('Lunch');
});
