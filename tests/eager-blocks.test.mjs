import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {eagerContentIds, loadsSecondBlockEager, mainLandingPaths} from '../src/lib/eager-blocks.mjs';

const blocks = [
  {id: '1740196951', kind: 'scene'},
  {id: 'gap', kind: 'spacer'},
  {id: '1423616591', kind: 'scene'},
  {id: '1423618261', kind: 'scene'},
];

const overlays = new Set(['860237765', '1063609261', '2019108731', '2322512891', '770878605']);

function contentBlocks(page) {
  const popupScenes = new Set((page.popups || []).flatMap((popup) => (popup.scenes || []).map((id) => String(id).replace(/^rec/, ''))));
  return (page.blocks || []).filter((block) => !overlays.has(block.id) && !popupScenes.has(block.id) && block.kind !== 'anchor' && block.kind !== 'spacer');
}

test('homepage eager set is the hero and the block right after it', () => {
  assert.equal(loadsSecondBlockEager('/'), true);
  assert.deepEqual(eagerContentIds(blocks, true), ['1740196951', '1423616591']);
});

test('legal, copy and service pages keep only the first content block eager', () => {
  for (const path of ['/offer', '/personaldata', '/consent', '/page84128326.html', '/invent', '/support', '/b71']) {
    assert.equal(loadsSecondBlockEager(path), false);
  }
  assert.deepEqual(eagerContentIds(blocks, false), ['1740196951']);
});

test('blocks below the second stay out of the eager set', () => {
  assert.deepEqual(eagerContentIds(blocks, true), ['1740196951', '1423616591']);
});

test('each main course landing eager-loads the block after the hero', () => {
  const routes = JSON.parse(fs.readFileSync(new URL('../public/content/routes.json', import.meta.url), 'utf8'));
  const enabled = [];
  for (const route of routes) {
    const page = JSON.parse(fs.readFileSync(new URL(`../public/content/${route.page}.json`, import.meta.url), 'utf8'));
    const content = contentBlocks(page);
    const secondEager = loadsSecondBlockEager(route.path);
    const ids = eagerContentIds(content, secondEager);
    if (secondEager) {
      assert.equal(content.length >= 2, true, route.path);
      assert.deepEqual(ids, [content[0].id, content[1].id]);
      enabled.push(route.path);
    } else if (content[0]) {
      assert.deepEqual(ids, [content[0].id]);
    } else {
      assert.deepEqual(ids, []);
    }
  }
  assert.equal(enabled.length, mainLandingPaths.size);
  for (const path of mainLandingPaths) assert.equal(enabled.includes(path), true, path);
});
