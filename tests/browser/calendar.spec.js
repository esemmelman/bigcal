import {test,expect} from '@playwright/test';
test('crowded days grow without overlap and backup text is safely rendered',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.month')).toHaveCount(12);
 const now=new Date(),date=`${now.getFullYear()}-${now.getMonth()+1}-7`;
 const tasks=Array.from({length:15},(_,i)=>({title:i===0?'<script>alert(1)</script>':`Long appointment ${i} with enough text to wrap onto multiple lines`,date,time:'09:00',notes:'Some details'}));
 await page.locator('#import').setInputFiles({name:'dayflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({tasks}))});
 await expect(page.locator('.event')).toHaveCount(15);await expect(page.locator('.event').first()).toContainText('<script>alert(1)</script>');
 const geometry=await page.evaluate(()=>{const months=[...document.querySelectorAll('.month')],day=document.querySelector('.day:has(.event)'),events=[...day.querySelectorAll('.event')];return {bottom:events.at(-1).getBoundingClientRect().bottom,dayBottom:day.getBoundingClientRect().bottom,rowBottom:months[0].getBoundingClientRect().bottom,nextTop:months[1].getBoundingClientRect().top,overlap:events.some((e,i)=>i&&e.getBoundingClientRect().top<events[i-1].getBoundingClientRect().bottom)};});
 expect(geometry.bottom).toBeLessThan(geometry.dayBottom);expect(geometry.nextTop).toBeGreaterThanOrEqual(geometry.rowBottom);expect(geometry.overlap).toBe(false);expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/bigcal-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#calendar')).toBeVisible();
 expect(await page.locator('#calendar').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);await page.screenshot({path:'test-results/bigcal-mobile.png'});
});
