import { useCallback, useReducer } from 'react';
import { QUESTIONS } from '../data/questions';
import { initialQuizState, QUESTIONS_PER_GAME, quizReducer, shuffle } from './logic';

export function useQuiz() {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState);

  const start = useCallback(() => {
    dispatch({ type: 'start', questions: shuffle(QUESTIONS).slice(0, QUESTIONS_PER_GAME) });
  }, []);
  const answer = useCallback((guess: boolean) => dispatch({ type: 'answer', guess }), []);
  const next = useCallback(() => dispatch({ type: 'next' }), []);

  return { state, start, answer, next };
}
