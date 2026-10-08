import express, { type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ScoreRepository } from './types.js';
import { parseLimit, parseNewScore } from './validation.js';

export interface AppOptions {
  trustProxy?: boolean;
  /** Max score submissions per client per minute. */
  submitLimitPerMinute?: number;
}

export function createApp(repo: ScoreRepository, options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use(express.json({ limit: '10kb' }));

  const submitLimiter = rateLimit({
    windowMs: 60_000,
    limit: options.submitLimitPerMinute ?? 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many score submissions. Try again in a minute.' },
  });

  const api = express.Router();

  // api
  api.get('/health', async (_req, res) => {
    try {
      await repo.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  api.get('/leaderboard', async (req, res) => {
    const limit = parseLimit(req.query.limit);
    if (!limit.ok) {
      res.status(400).json({ error: limit.error });
      return;
    }
    res.json({ entries: await repo.top(limit.value) });
  });

  api.post('/scores', submitLimiter, async (req, res) => {
    const input = parseNewScore(req.body);
    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }
    const entry = await repo.add(input.value);
    const rank = await repo.rankOf(entry.score);
    res.status(201).json({ entry, rank });
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  app.use('/api', api);

  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    // Errors from express.json() (malformed JSON, body too large) carry a 4xx status.
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Something went wrong.' : 'Invalid request body.' });
  };
  app.use(handleError);

  return app;
}
