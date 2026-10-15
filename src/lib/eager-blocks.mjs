// Публичные посадочные курсов с первым экраном и следующим блоком.
// Не входят юр-страницы, черновики «Copy of» / РЕДИЗ / Blank, служебные, туры и карточки упражнений.
export const mainLandingPaths = new Set([
  '/',
  '/fitness_for_health',
  '/intensiv',
  '/page_01',
  '/page_02',
  '/page_03',
  '/page_04',
  '/page_05',
  '/page57938753.html',
  '/page58191799.html',
  '/page58551483.html',
  '/page59461283.html',
  '/page59569323.html',
  '/page60259039.html',
  '/page67533869.html',
  '/pit',
  '/pitanie',
  '/pitanie_guide',
  '/stopi',
  '/tvg',
]);

export function loadsSecondBlockEager(path) {
  return mainLandingPaths.has(path || '');
}

export function eagerContentIds(blocks, secondEager) {
  const content = (blocks || []).filter((block) => block.kind !== 'anchor' && block.kind !== 'spacer');
  const ids = [];
  if (content[0]) ids.push(content[0].id);
  if (secondEager && content[1]) ids.push(content[1].id);
  return ids;
}
