import {createClient} from '@supabase/supabase-js';
import {config} from './config.js';
import {dateKey,monthsAhead,groupEvents,timeLabel,readEvents,dayOffsetLabel} from './calendar.js';
import {SESSION_KEY,sessionStorage} from './session.js';
import './style.css';
const $=id=>document.getElementById(id),storage=sessionStorage(localStorage);
const client=createClient(config.url,config.publishableKey,{auth:{storageKey:SESSION_KEY,storage,persistSession:true,autoRefreshToken:true}});
const months=monthsAhead(new Date(2026,9,1),15);
let events=[],user=null,channel=null,generation=0,imported=false,refreshTimer,activeDate=null,hideTimer;
function status(text){$('status').textContent=text;$('status').hidden=!text;}
function hideEvents(){clearTimeout(hideTimer);$('date-events').hidden=true;activeDate?.removeAttribute('aria-describedby');activeDate=null;}
let eventReturnDate=null,selectedEvent=null,mutating=false;
function resetEditor(){
  $('event-form').hidden=true;$('event-details').hidden=false;$('event-error').textContent='';
  $('event-confirm').hidden=true;$('delete-confirm').hidden=true;$('delete-cancel').hidden=true;
  const canWrite=Boolean(user&&!imported&&selectedEvent?.id!=null);
  $('event-edit').hidden=!canWrite;$('event-delete').hidden=!canWrite;
}
function setBusy(value){
  mutating=value;$('event-fields').disabled=value;
  for(const id of ['event-save','edit-cancel','event-edit','event-delete','delete-confirm','delete-cancel','event-close'])$(id).disabled=value;
}
function editingTimes(){const allDay=$('edit-allday').checked;$('edit-times').hidden=allDay;$('edit-start').required=!allDay;}
function openEvent(event,date){
  selectedEvent=event;resetEditor();
  eventReturnDate=activeDate;
  $('event-title').textContent=event.title;
  $('event-date').textContent=`${date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} · ${dayOffsetLabel(date)}`;
  $('event-time').textContent=timeLabel(event.time)+(event.endTime?` – ${timeLabel(event.endTime)}`:'');
  $('event-notes').textContent=event.notes||'No notes.';
  hideEvents();$('event-dialog').showModal();$('event-close').focus();
}
$('event-close').onclick=()=>$('event-dialog').close();
$('event-dialog').addEventListener('cancel',event=>{if(mutating)event.preventDefault();});
$('event-dialog').addEventListener('close',()=>{eventReturnDate?.focus();hideEvents();eventReturnDate=null;selectedEvent=null;});
$('event-edit').onclick=()=>{
  $('edit-title').value=selectedEvent.title;$('edit-date').value=selectedEvent.date;
  $('edit-start').value=selectedEvent.time?.slice(0,5)||'';$('edit-end').value=selectedEvent.endTime?.slice(0,5)||'';
  $('edit-allday').checked=!selectedEvent.time;$('edit-notes').value=selectedEvent.notes||'';editingTimes();
  $('event-form').hidden=false;$('event-details').hidden=true;$('event-edit').hidden=true;$('event-delete').hidden=true;$('event-error').textContent='';$('edit-title').focus();
};
$('edit-allday').onchange=editingTimes;
$('edit-cancel').onclick=resetEditor;
$('event-delete').onclick=()=>{$('event-confirm').hidden=false;$('delete-confirm').hidden=false;$('delete-cancel').hidden=false;$('event-edit').hidden=true;$('event-delete').hidden=true;$('delete-confirm').focus();};
$('delete-cancel').onclick=resetEditor;
async function writeEvent(remove=false){
  if(mutating)return;
  $('event-error').textContent='';
  if(!user||imported||selectedEvent?.id==null){$('event-error').textContent='Sign in and open a live DayFlow event to make changes.';return;}
  if(await checkExpiry())return;
  const eventId=selectedEvent.id,userId=user.id,allDay=$('edit-allday').checked;
  const title=$('edit-title').value.trim(),start=allDay?null:$('edit-start').value,end=allDay?null:($('edit-end').value||null);
  if(!remove&&(!title||!$('edit-date').value||(!allDay&&!start))){$('event-error').textContent='Enter a title, date, and start time, or choose All day.';return;}
  if(!remove&&end&&end<=start){$('event-error').textContent='End time must be after start time.';return;}
  setBusy(true);++generation;
  try{
    const changes={title,date:$('edit-date').value,start_time:start,end_time:end,notes:$('edit-notes').value,updated_at:new Date().toISOString()};
    if(!remove){if(allDay)changes.reminder_enabled=false;
      if(changes.date!==selectedEvent.date||start!==selectedEvent.time?.slice(0,5))changes.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    const query=remove?client.from('tasks').delete():client.from('tasks').update(changes);
    const {data,error}=await query.eq('user_id',userId).eq('id',eventId).select('id');
    if(error)throw error;if(data?.length!==1)throw new Error('This event is no longer available or could not be changed. Refresh and try again.');
    ++generation;setBusy(false);$('event-dialog').close();await refresh();
  }catch(error){$('event-error').textContent=`Could not ${remove?'delete':'save'} event: ${error.message}`;}
  finally{setBusy(false);}
}
$('event-form').onsubmit=event=>{event.preventDefault();writeEvent();};
$('delete-confirm').onclick=()=>writeEvent(true);
function showEvents(button,date,dayEvents){
  clearTimeout(hideTimer);hideEvents();activeDate=button;button.setAttribute('aria-describedby','date-events');
  const box=$('date-events');box.replaceChildren();const heading=document.createElement('strong');heading.textContent=`${date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} · ${dayOffsetLabel(date)}`;box.append(heading);
  if(!dayEvents.length){const empty=document.createElement('p');empty.textContent=user||imported?'No events.':'Sign in to see DayFlow events.';box.append(empty);}
  for(const event of dayEvents){
    const item=document.createElement('button');item.type='button';item.className='event';item.setAttribute('aria-haspopup','dialog');item.onclick=()=>openEvent(event,date);
    const time=document.createElement('time');time.textContent=timeLabel(event.time)+(event.endTime?` – ${timeLabel(event.endTime)}`:'');
    const title=document.createElement('div');title.textContent=event.title;item.append(time,title);
    if(event.notes){const notes=document.createElement('p');notes.textContent=event.notes;item.append(notes);}box.append(item);
  }
  const rect=button.getBoundingClientRect(),below=innerHeight-rect.bottom-16,above=rect.top-16;
  const useBelow=below>=120||below>=above;box.style.maxHeight=`${Math.max(50,useBelow?below:above)}px`;
  box.hidden=false;
  box.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-box.offsetWidth-8))}px`;
  box.style.top=`${useBelow?rect.bottom+8:Math.max(8,rect.top-box.offsetHeight-8)}px`;
}
function delayedHide(){hideTimer=setTimeout(hideEvents,150);}
$('date-events').onmouseenter=()=>clearTimeout(hideTimer);$('date-events').onmouseleave=delayedHide;
$('date-events').addEventListener('focusin',()=>clearTimeout(hideTimer));
$('date-events').addEventListener('focusout',event=>{if(!$('date-events').contains(event.relatedTarget))delayedHide();});
function render(){
  hideEvents();const query=$('search').value.trim().toLocaleLowerCase();
  const matches=events.filter(event=>!query||`${event.title} ${event.notes||''}`.toLocaleLowerCase().includes(query));
  const groups=groupEvents(matches),today=dateKey(new Date()),fragment=document.createDocumentFragment();
  let matchCount=0;
  $('range').textContent="Oct. '26 – Dec. '27";
  for(const [index,month] of months.entries()){
    const row=document.createElement('section');row.className='month';row.setAttribute('aria-label',`${month.label} ${month.year}`);
    if((index+1)%3===0&&index<months.length-1)row.classList.add('quarter-end');
    const heading=document.createElement('h2');heading.className='month-heading';heading.textContent=`${month.label}.`;heading.title=String(month.year);row.append(heading);
    for(const date of month.days){
      const key=dateKey(date),button=document.createElement('button'),dayEvents=groups.get(key)||[];button.type='button';button.className='day';button.dataset.date=key;button.textContent=date.getDate();
      button.setAttribute('aria-label',date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}));
      if(key===today)button.classList.add('today');
      if(query){button.classList.add(dayEvents.length?'search-match':'search-dim');matchCount+=dayEvents.length;}
      button.onmouseenter=()=>showEvents(button,date,dayEvents);button.onmouseleave=delayedHide;
      button.onfocus=()=>showEvents(button,date,dayEvents);button.onblur=delayedHide;
      button.onclick=()=>showEvents(button,date,dayEvents);row.append(button);
    }fragment.append(row);
  }$('calendar').replaceChildren(fragment);
  $('search-status').textContent=query?`${matchCount} matching ${matchCount===1?'event':'events'}`:'';
}
$('search').addEventListener('input',render);
async function checkExpiry(){
  if(!storage.expired())return false;
  ++generation;await client.auth.signOut({scope:'local'});await applySession(null);status('Your 90-day sign-in has expired. Sign in again.');return true;
}
async function refresh(){
  if(mutating||await checkExpiry()||!user||imported)return;
  const id=++generation,currentUser=user;status('Loading DayFlow events…');
  try{const data=await readEvents(client,currentUser.id,months);if(id!==generation)return;events=data;render();status(events.length?'':'No DayFlow events found for Oct. 2026 – Dec. 2027. Check that DayFlow is synced to this same account, or open a backup.');}
  catch(error){if(id===generation)status(`Could not load events: ${error.message}. Choose Refresh to retry.`);}
}
async function applySession(session){
  const next=session?.user||null;if(next?.id===user?.id)return;
  if($('event-dialog').open)$('event-dialog').close();
  ++generation;user=next;events=[];imported=false;render();
  if(channel){client.removeChannel(channel);channel=null;}
  $('account').textContent=user?'Sign out':'Sign in';
  if(!user){status('');return;}
  $('auth').close();$('password').value='';
  channel=client.channel(`bigcal:${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`user_id=eq.${user.id}`},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,300);}).subscribe();
  await refresh();
}
$('account').onclick=async()=>{if(user){const {error}=await client.auth.signOut({scope:'local'});if(error)status(error.message);}else{$('auth-error').textContent='';$('auth').showModal();$('email').focus();}};
$('cancel').onclick=()=>$('auth').close();
$('login').onsubmit=async event=>{
  event.preventDefault();$('submit').disabled=true;$('auth-error').textContent='';
  try{storage.renew();const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;}
  catch(error){storage.removeItem(SESSION_KEY);$('auth-error').textContent=error.message;}finally{$('submit').disabled=false;}
};
$('refresh').onclick=()=>{if(user){imported=false;refresh();}else status(imported?'Backup loaded. Open a newer backup to update events.':'Sign in to refresh events from DayFlow.');};
$('import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text()),tasks=Array.isArray(data)?data:data.tasks;if(!Array.isArray(tasks)||tasks.some(t=>!t||typeof t.title!=='string'))throw new Error('Choose a DayFlow JSON backup.');++generation;events=tasks;imported=true;render();status('');}catch(error){status(error.message);}event.target.value='';};
client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>applySession(session),0));
setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideEvents();});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.day,#date-events'))hideEvents();});
$('calendar').addEventListener('scroll',hideEvents);window.addEventListener('resize',hideEvents);
render();
