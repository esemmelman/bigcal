export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function daysFromToday(date,now=new Date()) {
  const dayNumber=value=>Date.UTC(value.getFullYear(),value.getMonth(),value.getDate())/86400000;
  return dayNumber(date)-dayNumber(now);
}
export function dayOffsetLabel(date,now=new Date()) {
  const days=daysFromToday(date,now),count=Math.abs(days);
  return days===0?'Today · 0 days from today':`${count} ${count===1?'day':'days'} ${days>0?'from today':'ago'}`;
}
export function normalizeDate(value) {
  if(typeof value !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return null;
  const [y,m,d]=value.split('-').map(Number), date=new Date(y,m-1,d);
  return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d ? dateKey(date) : null;
}
export function monthsAhead(now=new Date(),count=12) {
  return Array.from({length:count},(_,i)=>{
    const start=new Date(now.getFullYear(),now.getMonth()+i,1);
    return {start,label:start.toLocaleDateString('en-US',{month:'short'}),year:start.getFullYear(),days:Array.from({length:new Date(start.getFullYear(),start.getMonth()+1,0).getDate()},(_,d)=>new Date(start.getFullYear(),start.getMonth(),d+1))};
  });
}
export function groupEvents(tasks) {
  const groups=new Map();
  for(const task of tasks){
    const date=normalizeDate(task.date);
    if(!date || typeof task.title!=='string') continue;
    const event={...task,date,time:task.start_time??task.time??null,endTime:task.end_time??task.endTime??null};
    if(!groups.has(date)) groups.set(date,[]);
    groups.get(date).push(event);
  }
  for(const events of groups.values()) events.sort((a,b)=>(a.time||'').localeCompare(b.time||'') || a.title.localeCompare(b.title));
  return groups;
}
export function timeLabel(time) {
  if(!time) return 'All day';
  const [h,m]=time.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;
}
export async function readEvents(client,userId,months) {
  const result=[],from=dateKey(months[0].start),last=months.at(-1).start,to=dateKey(new Date(last.getFullYear(),last.getMonth()+1,1));
  for(let offset=0;;offset+=500){
    const {data,error}=await client.from('tasks').select('id,title,date,start_time,end_time,notes,color').eq('user_id',userId).gte('date',from).lt('date',to).order('date').order('id').range(offset,offset+499);
    if(error) throw error;
    result.push(...data);
    if(data.length<500) return result;
  }
}
