import test from 'node:test';
import assert from 'node:assert/strict';
import {docLinks} from '../src/lib/doc-links.mjs';

test('адрес сайта становится локальной ссылкой, точка остаётся текстом', () => {
  assert.equal(docLinks('<p>Сайт https://medvediva.ru/personaldata.</p>'), '<p>Сайт <a href="/personaldata">https://medvediva.ru/personaldata</a>.</p>');
});

test('почта становится mailto', () => {
  assert.equal(docLinks('пишите на care@medvediva.ru, ответим'), 'пишите на <a href="mailto:care@medvediva.ru">care@medvediva.ru</a>, ответим');
});

test('существующие ссылки не дублируются', () => {
  const html = '<a href="mailto:care@medvediva.ru">care@medvediva.ru</a>';
  assert.equal(docLinks(html), html);
});

test('пустой href у ссылки-адреса заполняется', () => {
  assert.equal(docLinks('<a href="">https://medvediva.ru</a>'), '<a href="/">https://medvediva.ru</a>');
});

test('внешний адрес остаётся абсолютным, атрибуты тегов не трогаются', () => {
  assert.equal(docLinks('<img src="https://x.ru/a.png"> https://example.com/a'), '<img src="https://x.ru/a.png"> <a href="https://example.com/a">https://example.com/a</a>');
});
