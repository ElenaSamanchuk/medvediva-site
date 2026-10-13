function store(name){return {getItem(key){try{return globalThis[name]?.getItem(key)??null;}catch{return null;}},setItem(key,value){try{globalThis[name]?.setItem(key,value);}catch{/* Non-persistent mode keeps the current screen usable. */}}};}
export const localStore=store('localStorage');
export const sessionStore=store('sessionStorage');
