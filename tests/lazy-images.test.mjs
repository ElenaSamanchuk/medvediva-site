import test from 'node:test';
import assert from 'node:assert/strict';
import {lazyImages, deferBackground, backgroundFetchImg} from '../src/lib/lazy-images.mjs';

test('img markup gets lazy and async before the browser runs scripts', () => {
  const html = '<img class="scene-image" src="/media/a.png" alt=""/>';
  assert.equal(lazyImages(html), '<img class="scene-image" src="/media/a.png" alt="" decoding="async" loading="lazy">');
  assert.equal(lazyImages('<img src="/x.png" loading="eager">'), '<img src="/x.png" loading="eager">');
  assert.equal(lazyImages('без картинки'), 'без картинки');
});

test('below-fold background keeps the painted file and drops the placeholder url', () => {
  const style = "background-image:url('https://thb.tildacdn.com/tiny.png');;background-image:url(\"/media/full.png\")";
  const deferred = deferBackground(style);
  assert.equal(deferred.url, '/media/full.png');
  assert.equal(deferred.style.includes('background-image'), false);
  assert.match(backgroundFetchImg(deferred.url), /loading="lazy"/);
  assert.match(backgroundFetchImg(deferred.url), /decoding="async"/);
  assert.match(backgroundFetchImg(deferred.url), /src="\/media\/full.png"/);
});
