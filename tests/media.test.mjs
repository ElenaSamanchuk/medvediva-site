import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mediaSource,useNativeHls} from '../src/lib/media.mjs';
test('Kinescope fragments keep only documented stream parameters',()=>{
 const result=mediaSource('https://kinescope.io/embed/iybjGEYtGedq8nm6hd8KQd?seek=60&duration=30&autoplay=1&token=secret');
 assert.equal(result.manifest,'https://kinescope.io/iybjGEYtGedq8nm6hd8KQd/master.m3u8?seek=60&duration=30');
 assert.equal(result.external,'https://kinescope.io/iybjGEYtGedq8nm6hd8KQd?seek=60&duration=30');
});
test('Other video services have no guessed stream URL',()=>{
 assert.equal(mediaSource('https://www.youtube.com/embed/ABCDEFGH').manifest,null);
 for(const url of ['javascript:alert(1)','https://kinescope.io.evil.invalid/embed/ABCDEFGH','https://user:pass@kinescope.io/ABCDEFGH','https://kinescope.io/path/ABCDEFGH','https://example.invalid/movie'])assert.equal(mediaSource(url),null);
});
test('Invalid cut values cannot enter the stream query',()=>{
 assert.equal(mediaSource('https://kinescope.io/ABCDEFGH?seek=-1&duration=0&autoplay=true').manifest,'https://kinescope.io/ABCDEFGH/master.m3u8');
});

test('Chromium uses MSE even when its media API advertises native HLS',()=>{
 assert.equal(useNativeHls('Mozilla/5.0 AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36'),false);
 assert.equal(useNativeHls('Mozilla/5.0 Macintosh AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'),true);
 assert.equal(useNativeHls('Mozilla/5.0 iPhone AppleWebKit/605.1.15 CriOS/145.0 Mobile Safari/604.1'),true);
});

import {embedSrc} from '../src/lib/media.mjs';
test('embedSrc: Kinescope и YouTube в iframe, чужие адреса отбрасываются', () => {
 assert.equal(embedSrc('https://kinescope.io/embed/iybjGEYtGedq8nm6hd8KQd'),'https://kinescope.io/embed/iybjGEYtGedq8nm6hd8KQd');
 assert.equal(embedSrc('https://kinescope.io/iybjGEYtGedq8nm6hd8KQd'),'https://kinescope.io/embed/iybjGEYtGedq8nm6hd8KQd');
 assert.equal(embedSrc('https://www.youtube.com/embed/AbJEwOJdMmM'),'https://www.youtube-nocookie.com/embed/AbJEwOJdMmM');
 assert.equal(embedSrc('http://kinescope.io/embed/iybjGEYtGedq8nm6hd8KQd'),null);
 assert.equal(embedSrc('https://evil.example/embed/x'),null);
});
