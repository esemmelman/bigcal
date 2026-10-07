export const SESSION_KEY='bigcal-auth';
export const DEADLINE_KEY='bigcal-auth-deadline';
export const NINETY_DAYS=90*24*60*60*1000;
export function sessionStorage(storage,now=Date.now){
  function expired(){const deadline=Number(storage.getItem(DEADLINE_KEY));return deadline>0&&now()>=deadline;}
  return {
    expired,
    renew(){storage.setItem(DEADLINE_KEY,String(now()+NINETY_DAYS));},
    getItem(key){if(key===SESSION_KEY&&expired()){storage.removeItem(SESSION_KEY);return null;}return storage.getItem(key);},
    setItem(key,value){if(key===SESSION_KEY){if(expired())return;if(!storage.getItem(DEADLINE_KEY))this.renew();}storage.setItem(key,value);},
    removeItem(key){storage.removeItem(key);if(key===SESSION_KEY)storage.removeItem(DEADLINE_KEY);}
  };
}
