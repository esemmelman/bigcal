import {createClient} from '@supabase/supabase-js';
import {config} from './config.js';
import {dateKey,monthsAhead,groupEvents,timeLabel,readEvents} from './calendar.js';
import './style.css';
const $=id=>document.getElementById(id),client=createClient(config.url,config.publishableKey,{auth:{storageKey:'bigcal-auth'}});
let months=monthsAhead(),events=[],user=null,channel=null,generation=0,imported=false,refreshTimer;
function status(text){$('status').textContent=text;}
function render(){
  const groups=groupEvents(events),today=dateKey(new Date()),fragment=document.createDocumentFragment();
  $('range').textContent=`${months[0].label} ${months[0].year} — ${months.at(-1).label} ${months.at(-1).year}`;
  for(const month of months){
    const row=document.createElement('section');row.className='month';row.setAttribute('aria-label',`${month.label} ${month.year}`);
    const heading=document.createElement('h2');heading.className='month-heading';heading.append(month.label);
    const year=document.createElement('span');year.textContent=month.year;heading.append(year);row.append(heading);
    for(const date of month.days){
      const key=dateKey(date),cell=document.createElement('div');cell.className='day';cell.dataset.date=key;
      if([0,6].includes(date.getDay()))cell.classList.add('weekend');if(key===today)cell.classList.add('today');
      const label=document.createElement('div');label.className='date';const number=document.createElement('b');number.textContent=date.getDate();
      const weekday=document.createElement('small');weekday.textContent=date.toLocaleDateString('en-US',{weekday:'short'});label.append(number,weekday);cell.append(label);
      for(const event of groups.get(key)||[]){
        const item=document.createElement(event.notes?'details':'div');item.className='event';
        if(/^#[0-9a-f]{6}$/i.test(event.color||''))item.style.setProperty('--event-color',event.color);
        const content=document.createElement(event.notes?'summary':'div'),time=document.createElement('time');time.textContent=timeLabel(event.time)+(event.endTime?` – ${timeLabel(event.endTime)}`:'');
        content.append(time,document.createTextNode(event.title));item.append(content);
        if(event.notes){const notes=document.createElement('p');notes.textContent=event.notes;item.append(notes);}cell.append(item);
      }row.append(cell);
    }
    for(let i=month.days.length;i<31;i++){const blank=document.createElement('div');blank.className='blank';row.append(blank);}fragment.append(row);
  }$('calendar').replaceChildren(fragment);
}
async function refresh(){
  if(!user||imported)return;
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
$('account').onclick=async()=>{if(user){const {error}=await client.auth.signOut();if(error)status(error.message);}else{$('auth-error').textContent='';$('auth').showModal();$('email').focus();}};
$('cancel').onclick=()=>$('auth').close();
$('login').onsubmit=async event=>{event.preventDefault();$('submit').disabled=true;$('auth-error').textContent='';try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;}catch(error){$('auth-error').textContent=error.message;}finally{$('submit').disabled=false;}};
$('refresh').onclick=()=>{if(user){imported=false;refresh();}else status(imported?'Backup loaded. Open a newer backup to update events.':'Sign in to refresh events from DayFlow.');};
$('width').oninput=event=>document.documentElement.style.setProperty('--day-width',`${event.target.value}px`);
$('import').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text()),tasks=Array.isArray(data)?data:data.tasks;if(!Array.isArray(tasks)||tasks.some(t=>!t||typeof t.title!=='string'))throw new Error('Choose a DayFlow JSON backup.');++generation;events=tasks;imported=true;render();status(`Backup loaded · ${tasks.filter(t=>t.date).length} dated events (not live)`);}catch(error){status(error.message);}event.target.value='';};
client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>applySession(session),0));
setInterval(()=>{const updated=monthsAhead();if(dateKey(updated[0].start)!==dateKey(months[0].start)){months=updated;render();}refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
render();
