import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../data/questions';
import { getRank, initialQuizState, pointsFor, quizReducer, shuffle } from './logic';
import type { Question, QuizState } from './types';

const questions: Question[] = [
  { id: 'a', claim: 'A', isTrue: true, explanation: '' },
  { id: 'b', claim: 'B', isTrue: false, explanation: '' },
  { id: 'c', claim: 'C', isTrue: true, explanation: '' },
];

function play(guesses: boolean[]): QuizState {
  let state = quizReducer(initialQuizState, { type: 'start', questions });
  for (const guess of guesses) {
    state = quizReducer(state, { type: 'answer', guess });
    state = quizReducer(state, { type: 'next' });
  }
  return state;
}

describe('shuffle', () => {
  it('keeps every item and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).toHaveLength(5);
    expect([...result].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('pointsFor', () => {
  it('rewards streaks up to a cap', () => {
    expect(pointsFor(0)).toBe(0);
    expect(pointsFor(1)).toBe(100);
    expect(pointsFor(2)).toBe(125);
    expect(pointsFor(5)).toBe(200);
    expect(pointsFor(20)).toBe(200);
  });
});

describe('getRank', () => {
  it('maps accuracy to a rank', () => {
    expect(getRank(10, 10).title).toBe('Editor-in-Chief');
    expect(getRank(8, 10).title).toBe('Fact Checker');
    expect(getRank(5, 10).title).toBe('Staff Reporter');
    expect(getRank(3, 10).title).toBe('Intern');
    expect(getRank(0, 10).title).toBe('Tabloid Believer');
    expect(getRank(0, 0).title).toBe('Tabloid Believer');
  });
});

describe('quizReducer', () => {
  it('scores a perfect game with streak bonuses and finishes', () => {
    const state = play([true, false, true]);
    expect(state.phase).toBe('finished');
    expect(state.score).toBe(100 + 125 + 150);
    expect(state.bestStreak).toBe(3);
  });

  it('resets the streak on a wrong answer', () => {
    const state = play([true, true, true]);
    expect(state.answers.map((a) => a.correct)).toEqual([true, false, true]);
    expect(state.score).toBe(200);
    expect(state.streak).toBe(1);
    expect(state.bestStreak).toBe(1);
  });

  it('ignores a second answer to the same question', () => {
    let state = quizReducer(initialQuizState, { type: 'start', questions });
    state = quizReducer(state, { type: 'answer', guess: true });
    const again = quizReducer(state, { type: 'answer', guess: false });
    expect(again).toBe(state);
  });

  it('does not advance before the question is answered', () => {
    const state = quizReducer(initialQuizState, { type: 'start', questions });
    expect(quizReducer(state, { type: 'next' })).toBe(state);
  });
});

describe('question bank', () => {
  it('has unique ids and enough questions for a game', () => {
    const ids = new Set(QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(QUESTIONS.length);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(10);
  });
});
