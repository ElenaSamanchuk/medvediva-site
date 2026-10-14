import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBase, prefixRootUrls, stripBase, withBase} from '../src/lib/site-base.mjs';

test('GitHub Pages base prefixes root paths once and keeps the site route', () => {
  const base = normalizeBase('/medvediva-site/');
  assert.equal(base, '/medvediva-site');
  assert.equal(normalizeBase('/'), '');
  assert.equal(withBase('/media/a.png', base), '/medvediva-site/media/a.png');
  assert.equal(withBase('/medvediva-site/media/a.png', base), '/medvediva-site/media/a.png');
  assert.equal(withBase('/pit?utm_source=site#price', base), '/medvediva-site/pit?utm_source=site#price');
  assert.equal(withBase('https://medvediva.ru/pit', base), 'https://medvediva.ru/pit');
  assert.equal(withBase('/media/a.png', ''), '/media/a.png');
  assert.equal(stripBase('/medvediva-site/pit/', base), '/pit');
  assert.equal(stripBase('/medvediva-site', base), '/');
  assert.equal(stripBase('/pit/', ''), '/pit');
  const css = "background-image:url('/media/full.png');src:url(/fonts/a.woff)";
  const next = prefixRootUrls(css, base);
  assert.equal(next, "background-image:url('/medvediva-site/media/full.png');src:url(/medvediva-site/fonts/a.woff)");
  assert.equal(prefixRootUrls(next, base), next);
});
