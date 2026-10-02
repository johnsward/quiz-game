import { describe, expect, it } from 'vitest';
import { parseLimit, parseNewScore } from './validation.js';

describe('parseNewScore', () => {
  it('accepts a valid score and tidies the name', () => {
    expect(parseNewScore({ name: '  Ada   Lovelace ', score: 450, correct: 4 })).toEqual({
      ok: true,
      value: { name: 'Ada Lovelace', score: 450, correct: 4 },
    });
  });

  it.each([
    ['not an object', 'hello'],
    ['an array', []],
    ['missing name', { score: 100, correct: 1 }],
    ['empty name', { name: '   ', score: 100, correct: 1 }],
    ['too long name', { name: 'x'.repeat(25), score: 100, correct: 1 }],
    ['control characters', { name: 'bad\u0007name', score: 100, correct: 1 }],
    ['zero-width characters', { name: 'sneaky​name', score: 100, correct: 1 }],
    ['fractional correct', { name: 'A', score: 100, correct: 1.5 }],
    ['too many correct', { name: 'A', score: 1100, correct: 11 }],
    ['score as string', { name: 'A', score: '100', correct: 1 }],
    ['score too high for correct count', { name: 'A', score: 401, correct: 2 }],
    ['score too low for correct count', { name: 'A', score: 199, correct: 2 }],
    ['points with no correct answers', { name: 'A', score: 100, correct: 0 }],
  ])('rejects %s', (_label, body) => {
    expect(parseNewScore(body).ok).toBe(false);
  });

  it('counts emoji as single characters', () => {
    expect(parseNewScore({ name: '🦘'.repeat(24), score: 0, correct: 0 }).ok).toBe(true);
  });
});

describe('parseLimit', () => {
  it('defaults to 10', () => {
    expect(parseLimit(undefined)).toEqual({ ok: true, value: 10 });
  });

  it.each(['0', '51', '-1', '2.5', 'abc', ''])('rejects %j', (raw) => {
    expect(parseLimit(raw).ok).toBe(false);
  });

  it('rejects repeated query params', () => {
    expect(parseLimit(['5', '6']).ok).toBe(false);
  });
});
