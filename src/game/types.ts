export interface Question {
  id: string;
  claim: string;
  isTrue: boolean;
  explanation: string;
}

export type Phase = 'start' | 'playing' | 'finished';

export interface AnswerRecord {
  question: Question;
  guess: boolean;
  correct: boolean;
  points: number;
}

export interface QuizState {
  phase: Phase;
  questions: Question[];
  /** Index of the current question. */
  index: number;
  /** One record per answered question, in order. */
  answers: AnswerRecord[];
  score: number;
  streak: number;
  bestStreak: number;
}

export type QuizAction =
  | { type: 'start'; questions: Question[] }
  | { type: 'answer'; guess: boolean }
  | { type: 'next' }
  | { type: 'restart' };

export interface Rank {
  title: string;
  blurb: string;
}
