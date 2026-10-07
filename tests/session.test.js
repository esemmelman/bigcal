import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionStorage,SESSION_KEY,DEADLINE_KEY,NINETY_DAYS} from '../src/session.js';
test('session survives reload and refresh without extending its 90-day deadline',()=>{
 const values=new Map(),base={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 let time=1000;const store=sessionStorage(base,()=>time);store.renew();store.setItem(SESSION_KEY,'token');time+=NINETY_DAYS-1;
 assert.equal(sessionStorage(base,()=>time).getItem(SESSION_KEY),'token');store.setItem(SESSION_KEY,'refreshed');assert.equal(Number(values.get(DEADLINE_KEY)),1000+NINETY_DAYS);
 time++;assert.equal(store.getItem(SESSION_KEY),null);store.setItem(SESSION_KEY,'stale');assert.equal(store.getItem(SESSION_KEY),null);
 store.renew();store.setItem(SESSION_KEY,'new-login');assert.equal(store.getItem(SESSION_KEY),'new-login');store.removeItem(SESSION_KEY);assert.equal(base.getItem(DEADLINE_KEY),null);
});
