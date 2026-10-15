import test from 'node:test';
import assert from 'node:assert/strict';
import {lazyImages} from '../src/lib/lazy-images.mjs';

test('img markup gets lazy and async before the browser runs scripts', () => {
  const html = '<img class="scene-image" src="/media/a.png" alt=""/>';
  assert.equal(lazyImages(html), '<img class="scene-image" src="/media/a.png" alt="" decoding="async" loading="lazy">');
  assert.equal(lazyImages('<img src="/x.png" loading="eager">'), '<img src="/x.png" loading="eager">');
  assert.equal(lazyImages('без картинки'), 'без картинки');
});

test('background urls stay in markup: lazy only marks img, not css backgrounds', () => {
  const style = "background-image:url('/media/full.png')";
  assert.equal(lazyImages(style), style);
  assert.equal(lazyImages('<div style="background-image:url(/media/full.png)"></div>'), '<div style="background-image:url(/media/full.png)"></div>');
});
