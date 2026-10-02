import type { QuizAction, QuizState, Rank } from './types';

export const QUESTIONS_PER_GAME = 10;
export const BASE_POINTS = 100;
export const STREAK_BONUS = 25;
export const MAX_STREAK_BONUS = 100;

/** Returns a shuffled copy of the array (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Points for a correct answer, given the streak *including* that answer.
 * The first correct answer is worth 100. Every answer after that in the
 * same streak adds 25 more, up to a maximum bonus of +100.
 */
export function pointsFor(streak: number): number {
  if (streak < 1) return 0;
  return BASE_POINTS + Math.min((streak - 1) * STREAK_BONUS, MAX_STREAK_BONUS);
}

const RANKS: Array<{ min: number } & Rank> = [
  { min: 1, title: 'Editor-in-Chief', blurb: 'Not a single claim got past you. The presses are yours.' },
  { min: 0.8, title: 'Fact Checker', blurb: 'Sharp eyes. Very few stories sneak by on your watch.' },
  { min: 0.5, title: 'Staff Reporter', blurb: 'Solid instincts, with the odd headline you swallowed whole.' },
  { min: 0.3, title: 'Intern', blurb: 'You are learning the beat. Keep reading the fine print.' },
  { min: 0, title: 'Tabloid Believer', blurb: 'If it is printed in bold, you believe it. Bold choice.' },
];

export function getRank(correct: number, total: number): Rank {
  const ratio = total === 0 ? 0 : correct / total;
  const { title, blurb } = RANKS.find((rank) => ratio >= rank.min) ?? RANKS[RANKS.length - 1];
  return { title, blurb };
}

export function isRevealed(state: QuizState): boolean {
  return state.answers.length > state.index;
}

export const initialQuizState: QuizState = {
  phase: 'start',
  questions: [],
  index: 0,
  answers: [],
  score: 0,
  streak: 0,
  bestStreak: 0,
};

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'start':
      return { ...initialQuizState, phase: 'playing', questions: action.questions };

    case 'answer': {
      if (state.phase !== 'playing' || isRevealed(state)) return state;
      const question = state.questions[state.index];
      const correct = action.guess === question.isTrue;
      const streak = correct ? state.streak + 1 : 0;
      const points = correct ? pointsFor(streak) : 0;
      return {
        ...state,
        answers: [...state.answers, { question, guess: action.guess, correct, points }],
        score: state.score + points,
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
      };
    }

    case 'next':
      if (state.phase !== 'playing' || !isRevealed(state)) return state;
      if (state.index + 1 >= state.questions.length) {
        return { ...state, phase: 'finished' };
      }
      return { ...state, index: state.index + 1 };

    case 'restart':
      return initialQuizState;
  }
}
