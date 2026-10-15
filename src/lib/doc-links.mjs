// Адреса сайта и почты в юр-документах — ссылками, как в политике конфиденциальности (Елена 15.10.2026).
// medvediva.ru ведёт на локальный путь (дальше prefixRootUrls добавляет base), почта — mailto:.
// Текст внутри уже существующих <a> не трогается; пустой href у ссылки-адреса заполняется.

const ADDRESS = /(https?:\/\/[^\s<>"«»]+|www\.[^\s<>"«»]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
const TRAIL = /[.,;:!?)\]]+$/;

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function addressHref(address) {
  const text = String(address || '').replace(/&amp;/g, '&');
  if (!text.includes('://') && !text.startsWith('www.') && text.includes('@')) return `mailto:${text}`;
  const url = new URL(text.startsWith('www.') ? `https://${text}` : text);
  if (/^(www\.)?medvediva\.ru$/i.test(url.hostname)) return `${url.pathname || '/'}${url.search}${url.hash}`;
  return url.href;
}

function linkText(text) {
  return text.replace(ADDRESS, (match) => {
    const tail = match.match(TRAIL)?.[0] || '';
    const address = tail ? match.slice(0, -tail.length) : match;
    if (!address) return match;
    let href;
    try { href = addressHref(address); } catch { return match; }
    return `<a href="${escAttr(href)}">${address}</a>${tail}`;
  });
}

export function docLinks(html) {
  const parts = String(html || '').split(/(<[^>]+>)/);
  let insideLink = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part) continue;
    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) {
        insideLink += 1;
        const label = parts[i + 1] || '';
        if (/\shref=""/i.test(part) && /^\s*(https?:\/\/|www\.|[\w.+-]+@)/.test(label)) {
          try { parts[i] = part.replace(/\shref=""/i, ` href="${escAttr(addressHref(label.trim().replace(TRAIL, '')))}"`); } catch { /* оставить как есть */ }
        }
      } else if (/^<\/a>/i.test(part)) insideLink = Math.max(0, insideLink - 1);
      continue;
    }
    if (!insideLink) parts[i] = linkText(part);
  }
  return parts.join('');
}
