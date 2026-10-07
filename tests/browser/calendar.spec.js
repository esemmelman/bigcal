import {test,expect} from '@playwright/test';
test('compact Oct-Dec 2027 rows show events only in a hover box, with keyboard and touch support',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.month')).toHaveCount(3);await expect(page.locator('.month-heading')).toHaveText(['Oct.','Nov.','Dec.']);
 expect(await page.locator('.month').evaluateAll(rows=>rows.map(r=>r.querySelectorAll('.day').length))).toEqual([31,30,31]);
 const tasks=Array.from({length:15},(_,i)=>({title:i===0?'<script>alert(1)</script>':`Appointment ${i}`,date:'2027-10-7',time:'09:00',notes:'Some details'}));
 await page.locator('#import').setInputFiles({name:'dayflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({tasks}))});
 await expect(page.locator('#date-events')).toBeHidden();await expect(page.locator('#calendar .event')).toHaveCount(0);
 const date=page.locator('[data-date="2027-10-07"]');await date.hover();await expect(page.locator('#date-events')).toBeVisible();await expect(page.locator('.event')).toHaveCount(15);await expect(page.locator('.event').first()).toContainText('<script>alert(1)</script>');
 expect(await page.locator('.month').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(35);
 await page.screenshot({path:'test-results/bigcal-hover.png'});await page.mouse.move(5,5);await expect(page.locator('#date-events')).toBeHidden();
 await date.focus();await expect(page.locator('#date-events')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#date-events')).toBeHidden();
 await page.screenshot({path:'test-results/bigcal-compact.png'});await page.setViewportSize({width:390,height:844});await date.click();await expect(page.locator('#date-events')).toBeVisible();
 const box=await page.locator('#date-events').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);expect(errors).toEqual([]);
});
