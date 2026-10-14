import {prefixRootUrls, withBase} from './site-base.mjs';

const BG_URL = /background-image\s*:\s*url\(\s*(['"]?)([^)'"]+?)\1\s*\)\s*;?/gi;

export function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function lazyImages(html) {
  const source = prefixRootUrls(html || '') || '';
  if (!source || !/<img\b/i.test(source)) return source;
  return source.replace(/<img\b([^>]*?)\/?>/gi, (full, attrs) => {
    if (/\bloading\s*=/i.test(attrs)) return full;
    const body = attrs.replace(/\s*\/\s*$/, '');
    const decoding = /\bdecoding\s*=/i.test(body) ? '' : ' decoding="async"';
    return `<img${body}${decoding} loading="lazy">`;
  });
}

export function deferBackground(style) {
  const urls = [];
  const next = String(style || '').replace(BG_URL, (match, quote, url) => {
    const clean = String(url || '').trim();
    if (clean && clean !== 'none') urls.push(clean);
    return '';
  }).replace(/;{2,}/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
  return {style: next, url: urls.at(-1) || ''};
}

export function backgroundFetchImg(url) {
  return `<img class="scene-bg-fetch" alt="" aria-hidden="true" src="${escAttr(withBase(url))}" loading="lazy" decoding="async" style="position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none">`;
}
