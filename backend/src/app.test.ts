import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { InMemoryScoreRepository } from './test/inMemoryRepository.js';

let repo: InMemoryScoreRepository;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  repo = new InMemoryScoreRepository();
  app = createApp(repo, { submitLimitPerMinute: 100 });
});

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    await request(app).get('/api/health').expect(200, { status: 'ok' });
  });

  it('reports 503 when the database is down', async () => {
    repo.healthy = false;
    await request(app).get('/api/health').expect(503, { status: 'unavailable' });
  });
});

describe('POST /api/scores', () => {
  it('saves a score and returns its rank', async () => {
    await repo.add({ name: 'Top', score: 900, correct: 6 });

    const res = await request(app).post('/api/scores').send({ name: 'Ada', score: 450, correct: 4 }).expect(201);

    expect(res.body.entry).toMatchObject({ name: 'Ada', score: 450, correct: 4 });
    expect(res.body.rank).toBe(2);
    expect(repo.entries).toHaveLength(2);
  });

  it('rejects invalid input with 400 and saves nothing', async () => {
    const res = await request(app).post('/api/scores').send({ name: 'Cheater', score: 99999, correct: 10 }).expect(400);
    expect(res.body.error).toMatch(/score/);
    expect(repo.entries).toHaveLength(0);
  });

  it('rejects malformed JSON with 400', async () => {
    await request(app).post('/api/scores').set('Content-Type', 'application/json').send('{"name":').expect(400);
  });

  it('rate limits repeated submissions', async () => {
    const limited = createApp(repo, { submitLimitPerMinute: 2 });
    const body = { name: 'Spam', score: 100, correct: 1 };
    await request(limited).post('/api/scores').send(body).expect(201);
    await request(limited).post('/api/scores').send(body).expect(201);
    await request(limited).post('/api/scores').send(body).expect(429);
  });
});

describe('GET /api/leaderboard', () => {
  it('returns the highest scores first, earliest first on ties', async () => {
    await repo.add({ name: 'Low', score: 100, correct: 1 });
    await repo.add({ name: 'First', score: 500, correct: 4 });
    await repo.add({ name: 'Second', score: 500, correct: 4 });

    const res = await request(app).get('/api/leaderboard').expect(200);
    expect(res.body.entries.map((e: { name: string }) => e.name)).toEqual(['First', 'Second', 'Low']);
  });

  it('respects the limit parameter', async () => {
    for (let i = 1; i <= 5; i++) await repo.add({ name: `P${i}`, score: i * 100, correct: i });
    const res = await request(app).get('/api/leaderboard?limit=2').expect(200);
    expect(res.body.entries).toHaveLength(2);
  });

  it('rejects an invalid limit', async () => {
    await request(app).get('/api/leaderboard?limit=500').expect(400);
  });
});

it('returns 404 JSON for unknown API routes', async () => {
  await request(app).get('/api/nope').expect(404, { error: 'Not found.' });
});
