import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { eventMemory } from '../src/lib/passport-memory.js';

test('memory gating, fallback, deterministic layout and explicit removal', () => {
  const ev = { slug: 'one', earned: {}, phase: 'past', memory: { groupImage: '/group.jpg', portraitImage: '/private.jpg' } };
  assert.equal(eventMemory(ev).layout, 'playful');
  assert.deepEqual(eventMemory(ev), eventMemory(ev));
  assert.equal(eventMemory({ ...ev, earned: null }).portrait, null);
  assert.equal(eventMemory({ ...ev, phase: 'upcoming' }).group, null);
  assert.equal(eventMemory({ ...ev, memory: undefined, unlock: { type: 'image', src: '/old.jpg' } }).group, '/old.jpg');
  assert.equal(eventMemory({ ...ev, memory: { groupImage: '' }, unlock: { type: 'image', src: '/old.jpg' } }).group, '');
  assert.equal(eventMemory({ ...ev, type: 'merit', memory: {} }).layout, 'merit');
});

test('private portrait route uses authenticated identity, rejects traversal and sends no-store', async () => {
  let result = null, params, sql;
  mock.module('../server/db.js', { namedExports: { q: async () => [], one: async (s, p) => { sql = s; params = p; return result; }, parseJSON: (v, fallback) => v == null ? fallback : typeof v === 'string' ? JSON.parse(v) : v } });
  mock.module('../server/auth.js', { namedExports: { requireUser: (req, _res, next) => next(req.user ? undefined : Object.assign(new Error('login'), { status: 401 })), parseCookies: () => ({}), setCookie: () => {} } });
  mock.module('../server/passport.js', { namedExports: { passportOf: async () => ({}), attachInvite: async () => null, INVITE_COOKIE_NAME: 'invite', syncStamps: async () => {} } });
  const { default: router } = await import('../server/routes/passport.js');
  const handlers = router.stack.find(layer => layer.route?.path === '/passport/:slug/portrait').route.stack;
  const run = user => new Promise(resolve => {
    const req = { user, params: { slug: 'event', userId: 999 }, query: { userId: 999 } };
    const res = { headers: {}, set(k, v) { this.headers[k] = v; return this; }, sendFile(file, options) { resolve({ file, options, headers: this.headers }); } };
    let i = 0;
    const next = error => error ? resolve({ error }) : handlers[i++].handle(req, res, next);
    next();
  });
  assert.equal((await run(null)).error.status, 401);
  result = null; assert.equal((await run({ id: 22 })).error.status, 404);
  assert.deepEqual(params, [22, 'event']);
  assert.match(sql, /e.status <> 'hidden'/); assert.match(sql, /INTERVAL 6 HOUR/);
  result = { meta: { passportPortrait: '../someone.jpg' } }; assert.equal((await run({ id: 22 })).error.status, 404);
  result = { meta: { passportPortrait: '123-member.jpg' } };
  const sent = await run({ id: 22 });
  assert.equal(sent.file, '123-member.jpg'); assert.match(sent.options.root, /private-passport$/);
  assert.equal(sent.headers['Cache-Control'], 'private, no-store');
  mock.restoreAll();
});
