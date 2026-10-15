// Public HLS manifests documented by Kinescope; no access-token inference.
export function mediaSource(value) {
 try {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  if(!['kinescope.io','www.youtube.com','www.youtube-nocookie.com','player.vimeo.com','vk.com','vkvideo.ru'].includes(url.hostname))return null;
  if(url.hostname!=='kinescope.io')return {external:url.href,manifest:null};
  const match=url.pathname.match(/^\/(?:embed\/)?([A-Za-z0-9-]{8,64})\/?$/);
  if(!match)return null;
  const query=new URLSearchParams();
  for(const key of ['seek','duration']){
   const value=url.searchParams.get(key);
   if(value!==null&&/^\d+(?:\.\d+)?$/.test(value)&&Number.isFinite(Number(value))&&(key!=='duration'||Number(value)>0))query.set(key,value);
  }
  const suffix=query.size?`?${query}`:'';
  return {external:`https://kinescope.io/${match[1]}${suffix}`,manifest:`https://kinescope.io/${match[1]}/master.m3u8${suffix}`};
 }catch{return null;}
}

// Chromium may claim "maybe" for HLS without delivering native playback.
export function useNativeHls(userAgent) {
 return /iPhone|iPad|iPod/i.test(userAgent) || (/Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(userAgent));
}

// Адрес для iframe-плеера сервиса (Елена 15.10.2026: видео через iframe, как на Тильде).
// Только https и известные видеосервисы; YouTube — через youtube-nocookie.
export function embedSrc(value) {
 try {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  if(url.hostname==='kinescope.io'){
   const match=url.pathname.match(/^\/(?:embed\/)?([A-Za-z0-9-]{8,64})\/?$/);
   return match?`https://kinescope.io/embed/${match[1]}${url.search}`:null;
  }
  if(['www.youtube.com','youtube.com','www.youtube-nocookie.com'].includes(url.hostname)){
   const match=url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,20})$/);
   return match?`https://www.youtube-nocookie.com/embed/${match[1]}${url.search}`:null;
  }
  if(url.hostname==='youtu.be'){const id=url.pathname.slice(1);return /^[A-Za-z0-9_-]{6,20}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}`:null;}
  if(['player.vimeo.com','vk.com','vkvideo.ru'].includes(url.hostname))return url.href;
  return null;
 }catch{return null;}
}
