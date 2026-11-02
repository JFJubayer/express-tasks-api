import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let base;

beforeEach(async () => {
  server = http.createServer(createApp());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  const closed = once(server, 'close');
  server.close();
  server.closeAllConnections();
  await closed;
});

// An object body is sent as JSON; a string body is sent as-is (to test broken JSON).
async function api(method, url, body) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(base + url, options);
  return { status: res.status, body: await res.json() };
}

describe('POST /tasks', () => {
  test('adds a task and numbers them 1, 2, ...', async () => {
    const first = await api('POST', '/tasks', { title: 'Buy milk' });
    assert.equal(first.status, 201);
    assert.deepEqual(first.body, { id: 1, title: 'Buy milk', done: false });

    const second = await api('POST', '/tasks', { title: 'Read a book', done: true });
    assert.deepEqual(second.body, { id: 2, title: 'Read a book', done: true });
  });

  test('trims spaces around the title', async () => {
    const res = await api('POST', '/tasks', { title: '  Buy milk  ' });
    assert.equal(res.body.title, 'Buy milk');
  });

  test('returns 400 when the title is missing, empty or not a string', async () => {
    for (const body of [{}, { title: '' }, { title: '   ' }, { title: 42 }, { done: true }]) {
      const res = await api('POST', '/tasks', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error, 'title is required');
    }
    assert.deepEqual((await api('GET', '/tasks')).body, []);
  });

  test('returns 400 when done is not true or false', async () => {
    const res = await api('POST', '/tasks', { title: 'x', done: 'yes' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'done must be true or false');
  });

  test('returns 400 for broken JSON', async () => {
    const res = await api('POST', '/tasks', '{"title": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Invalid JSON');
  });

  test('returns 400 when no JSON body is sent', async () => {
    // fetch sends a string body as text/plain, which the JSON parser ignores
    const res = await fetch(`${base}/tasks`, { method: 'POST', body: 'title=x' });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /JSON body/);
  });
});

describe('GET /tasks', () => {
  test('starts empty', async () => {
    const res = await api('GET', '/tasks');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('lists the tasks in the order they were added', async () => {
    await api('POST', '/tasks', { title: 'one' });
    await api('POST', '/tasks', { title: 'two' });
    const res = await api('GET', '/tasks');
    assert.deepEqual(res.body.map((task) => task.title), ['one', 'two']);
  });
});

describe('GET /tasks/:id', () => {
  test('returns one task', async () => {
    await api('POST', '/tasks', { title: 'one' });
    await api('POST', '/tasks', { title: 'two' });
    const res = await api('GET', '/tasks/2');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: 2, title: 'two', done: false });
  });

  test('returns 404 when there is no such task', async () => {
    await api('POST', '/tasks', { title: 'one' });
    for (const id of ['99', '0', 'abc', '1abc', '0x1']) {
      const res = await api('GET', `/tasks/${id}`);
      assert.equal(res.status, 404, id);
      assert.equal(res.body.error, 'Task not found');
    }
  });
});

describe('PUT /tasks/:id', () => {
  test('updates the title and done', async () => {
    await api('POST', '/tasks', { title: 'old' });
    const res = await api('PUT', '/tasks/1', { title: 'new', done: true });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: 1, title: 'new', done: true });
    assert.deepEqual((await api('GET', '/tasks/1')).body, res.body);
  });

  test('done goes back to false when it is not sent', async () => {
    await api('POST', '/tasks', { title: 'old', done: true });
    const res = await api('PUT', '/tasks/1', { title: 'new' });
    assert.equal(res.body.done, false);
  });

  test('returns 400 without a title and leaves the task unchanged', async () => {
    await api('POST', '/tasks', { title: 'keep me' });
    const res = await api('PUT', '/tasks/1', { done: true });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'title is required');
    assert.deepEqual((await api('GET', '/tasks/1')).body, { id: 1, title: 'keep me', done: false });
  });

  test('returns 404 when there is no such task', async () => {
    const res = await api('PUT', '/tasks/5', { title: 'x' });
    assert.equal(res.status, 404);
  });
});

describe('other routes', () => {
  test('unknown routes return a JSON 404', async () => {
    const res = await api('GET', '/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Route not found');
  });
});
