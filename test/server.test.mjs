import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer } from '../app/server.js';
import { once } from 'node:events';

async function withServer(fn) {
  const server = createStaticServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('pages, health, and version respond; static allowlist serves the lab', async () => {
  await withServer(async base => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), 'ok');

    const version = await fetch(`${base}/version`);
    assert.equal(version.status, 200);
    assert.equal((await version.json()).name, 'ai-engineer-demo');

    const index = await fetch(`${base}/`);
    assert.equal(index.status, 200);
    const html = await index.text();
    assert.match(html, /<nav aria-label="Primary">/);
    assert.match(html, /href="\/guide\.html"/);
    assert.match(html, /Ai Engineer Lab/);

    const guide = await fetch(`${base}/guide.html`);
    assert.equal(guide.status, 200);
    assert.match(await guide.text(), /aria-current="page" href="\/guide\.html"/);

    const lab = await fetch(`${base}/lab.mjs`);
    assert.equal(lab.status, 200);
    assert.match(lab.headers.get('content-type'), /javascript/);
    assert.match(await lab.text(), /MAX_RISE/);
  });
});

test('/api/assess drives the failure mode end-to-end', async () => {
  await withServer(async base => {
    const skip = await fetch(`${base}/api/assess?basics=10&llms=95&rag=95&agents=95`);
    assert.equal(skip.status, 200);
    const crashed = await skip.json();
    assert.equal(crashed.demo.passed, true);
    assert.equal(crashed.ship.verdict, 'crashed');
    assert.equal(crashed.ship.crashedAt, 'retry-storm');
    assert.equal(crashed.ladder.effective.llms, 40);

    const ok = await fetch(`${base}/api/assess?basics=70&llms=75&rag=70&agents=80`);
    const shipped = await ok.json();
    assert.equal(shipped.ship.verdict, 'shipped');
  });
});

test('unknown paths and traversal return 404; HEAD works', async () => {
  await withServer(async base => {
    assert.equal((await fetch(`${base}/../package.json`)).status, 404);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
    assert.equal((await fetch(`${base}/app/server.js`)).status, 404);
    const head = await fetch(`${base}/`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  });
});
