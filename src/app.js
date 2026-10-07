import {createClient} from '@supabase/supabase-js';
import {config} from './config.js';
import {dateKey,monthsAhead,groupEvents,timeLabel,readEvents} from './calendar.js';
import {SESSION_KEY,sessionStorage} from './session.js';
import './style.css';
const $=id=>document.getElementById(id),storage=sessionStorage(localStorage);
const client=createClient(config.url,config.publishableKey,{auth:{storageKey:SESSION_KEY,storage,persistSession:true,autoRefreshToken:true}});
const months=monthsAhead(new Date(2027,9,1),3);
let events=[],user=null,channel=null,generation=0,imported=false,refreshTimer,activeDate=null,hideTimer;
function status(text){$('status').textContent=text;}
function hideEvents(){clearTimeout(hideTimer);$('date-events').hidden=true;activeDate?.removeAttribute('aria-describedby');activeDate=null;}
function showEvents(button,date,dayEvents){
  clearTimeout(hideTimer);hideEvents();activeDate=button;button.setAttribute('aria-describedby','date-events');
  const box=$('date-events');box.replaceChildren();const heading=document.createElement('strong');heading.textContent=date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});box.append(heading);
  if(!dayEvents.length){const empty=document.createElement('p');empty.textContent=user||imported?'No events.':'Sign in to see DayFlow events.';box.append(empty);}
  for(const event of dayEvents){
    const item=document.createElement('div');item.className='event';
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
function render(){
  hideEvents();const groups=groupEvents(events),today=dateKey(new Date()),fragment=document.createDocumentFragment();
  $('range').textContent='October – December 2027';
  for(const month of months){
    const row=document.createElement('section');row.className='month';row.setAttribute('aria-label',`${month.label} ${month.year}`);
    const heading=document.createElement('h2');heading.className='month-heading';heading.textContent=`${month.label}.`;row.append(heading);
    for(const date of month.days){
      const key=dateKey(date),button=document.createElement('button'),dayEvents=groups.get(key)||[];button.type='button';button.className='day';button.dataset.date=key;button.textContent=date.getDate();
      button.setAttribute('aria-label',date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}));
      if(key===today)button.classList.add('today');
      button.onmouseenter=()=>showEvents(button,date,dayEvents);button.onmouseleave=delayedHide;
      button.onfocus=()=>showEvents(button,date,dayEvents);button.onblur=delayedHide;
      button.onclick=()=>showEvents(button,date,dayEvents);row.append(button);
    }fragment.append(row);
  }$('calendar').replaceChildren(fragment);
}
async function checkExpiry(){
  if(!storage.expired())return false;
  ++generation;await client.auth.signOut({scope:'local'});await applySession(null);status('Your 90-day sign-in has expired. Sign in again.');return true;
}
async function refresh(){
  if(await checkExpiry()||!user||imported)return;
  const id=++generation,currentUser=user;status('Loading DayFlow events…');
  try{const data=await readEvents(client,currentUser.id,months);if(id!==generation)return;events=data;render();status(`${events.length} events · Updated ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`);}
  catch(error){if(id===generation)status(`Could not load events: ${error.message}. Choose Refresh to retry.`);}
}
async function applySession(session){
  const next=session?.user||null;if(next?.id===user?.id)return;
  ++generation;user=next;events=[];imported=false;render();
  if(channel){client.removeChannel(channel);channel=null;}
  $('account').textContent=user?'Sign out':'Sign in';
  if(!user){status('Sign in to see your DayFlow events, or open a DayFlow backup.');return;}
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
$('import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text()),tasks=Array.isArray(data)?data:data.tasks;if(!Array.isArray(tasks)||tasks.some(t=>!t||typeof t.title!=='string'))throw new Error('Choose a DayFlow JSON backup.');++generation;events=tasks;imported=true;render();status('Backup loaded (not live)');}catch(error){status(error.message);}event.target.value='';};
client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>applySession(session),0));
setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideEvents();});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.day,#date-events'))hideEvents();});
$('calendar').addEventListener('scroll',hideEvents);window.addEventListener('resize',hideEvents);
render();
