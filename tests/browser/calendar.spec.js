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
 await page.screenshot({path:'test-results/bigcal-compact.png'});await page.setViewportSize({width:390,height:844});await date.hover();await expect(page.locator('#date-events')).toBeVisible();
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

test('clicking a hover event opens its full details and closes with keyboard or button',async({page})=>{
 await page.goto('/');await page.locator('#import').setInputFiles({name:'events.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({tasks:[{title:'Appointment details',notes:'First line\nSecond line',date:'2026-10-07',time:'09:00',endTime:'10:00'}]}))});
 const date=page.locator('[data-date="2026-10-07"]');await date.hover();
 const dateRect=await date.boundingBox(),boxRect=await page.locator('#date-events').boundingBox();expect(boxRect.y).toBeCloseTo(dateRect.y+dateRect.height,1);
 await page.mouse.move(dateRect.x+dateRect.width/2,boxRect.y+5,{steps:10});await expect(page.locator('#date-events')).toContainText('Appointment details');
 await page.locator('#date-events .event').click();
 await expect(page.locator('#event-dialog')).toBeVisible();await expect(page.locator('#event-title')).toHaveText('Appointment details');await expect(page.locator('#event-time')).toHaveText('9:00 AM – 10:00 AM');await expect(page.locator('#event-notes')).toHaveText('First line\nSecond line');await expect(page.locator('#date-events')).toBeHidden();await expect(page.locator('#event-edit')).toBeHidden();await expect(page.locator('#event-delete')).toBeHidden();
 await page.locator('#event-close').click();await expect(page.locator('#event-dialog')).toBeHidden();
 await date.hover();await page.locator('#date-events .event').focus();await page.keyboard.press('Enter');await expect(page.locator('#event-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#event-dialog')).toBeHidden();
});

test('live edits save to the owned DayFlow event; failed saves keep fields; deletion requires confirmation',async({page})=>{
 const user={id:'12345678-1234-1234-1234-123456789012',aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 await page.addInitScript(({user})=>{localStorage.setItem('bigcal-auth',JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('bigcal-auth-deadline',String(Date.now()+90*86400000));},{user});
 let rows=[{id:'one',title:'Original',date:'2026-10-07',start_time:'09:00:00',end_time:null,notes:'Old notes'}],fail=true,deletes=0,patches=0;
 await page.route('**/rest/v1/tasks?**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()==='GET'){await route.fulfill({json:rows});return;}
   expect(url.searchParams.get('user_id')).toBe(`eq.${user.id}`);expect(url.searchParams.get('id')).toBe('eq.one');
   if(request.method()==='PATCH'){
     patches++;if(fail){await route.fulfill({status:500,json:{message:'Test save failure'}});return;}
     const changes=request.postDataJSON();expect(changes).not.toHaveProperty('reminder_minutes');expect(changes).not.toHaveProperty('color');rows=[{...rows[0],...changes}];await route.fulfill({json:[{id:'one'}]});return;
   }
   if(request.method()==='DELETE'){deletes++;rows=[];await route.fulfill({json:[{id:'one'}]});return;}
 });
 await page.goto('/');await expect(page.locator('#account')).toHaveText('Sign out');
 await page.locator('[data-date="2026-10-07"]').hover();await page.locator('#date-events .event').click();await page.locator('#event-edit').click();
 await page.locator('#edit-title').fill('Changed');await page.locator('#edit-date').fill('2026-10-08');await page.locator('#edit-notes').fill('New notes');await page.locator('#event-save').click();
 await expect(page.locator('#event-error')).toContainText('Test save failure');await expect(page.locator('#edit-title')).toHaveValue('Changed');await expect(page.locator('#event-dialog')).toBeVisible();fail=false;
 await page.locator('#edit-allday').check();await page.locator('#event-save').click();await expect(page.locator('#event-dialog')).toBeHidden();
 expect(rows[0].reminder_enabled).toBe(false);expect(rows[0].start_time).toBeNull();expect(patches).toBe(2);
 await page.locator('[data-date="2026-10-08"]').hover();await expect(page.locator('#date-events')).toContainText('Changed');await page.locator('#date-events .event').click();await page.locator('#event-delete').click();
 await expect(page.locator('#event-confirm')).toBeVisible();expect(deletes).toBe(0);await page.locator('#delete-cancel').click();expect(deletes).toBe(0);
 await page.locator('#event-delete').click();await page.locator('#delete-confirm').click();await expect(page.locator('#event-dialog')).toBeHidden();expect(deletes).toBe(1);
 await page.locator('[data-date="2026-10-08"]').hover();await expect(page.locator('#date-events')).toContainText('No events.');
});

test('clicking a date opens a prefilled add form and saves a new DayFlow event',async({page})=>{
 const user={id:'12345678-1234-1234-1234-123456789012',aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 await page.addInitScript(({user})=>{localStorage.setItem('bigcal-auth',JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('bigcal-auth-deadline',String(Date.now()+90*86400000));},{user});
 let rows=[],inserts=0;
 await page.route('**/rest/v1/tasks?**',async route=>{
   if(route.request().method()==='POST'){const row=route.request().postDataJSON();expect(row.user_id).toBe(user.id);expect(row.date).toBe('2026-10-08');expect(row.title).toBe('New appointment');expect(row.start_time).toBe('09:30');expect(row.id).toBeTruthy();inserts++;rows=[row];await route.fulfill({json:[{id:row.id}]});}
   else await route.fulfill({json:rows});
 });
 await page.goto('/');await expect(page.locator('#account')).toHaveText('Sign out');await page.locator('[data-date="2026-10-08"]').click();
 await expect(page.locator('#event-title')).toHaveText('Add event');await expect(page.locator('#edit-date')).toHaveValue('2026-10-08');await expect(page.locator('#event-delete')).toBeHidden();
 await page.locator('#edit-cancel').click();expect(inserts).toBe(0);
 await page.locator('[data-date="2026-10-08"]').click();await page.locator('#edit-title').fill('New appointment');await page.locator('#edit-allday').uncheck();await page.locator('#edit-start').fill('09:30');await page.locator('#event-save').click();
 await expect(page.locator('#event-dialog')).toBeHidden();expect(inserts).toBe(1);await page.locator('[data-date="2026-10-08"]').hover();await expect(page.locator('#date-events')).toContainText('New appointment');
});
