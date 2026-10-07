import { useEffect, useState } from 'react';
import { Masthead } from './components/Masthead';
import { QuestionScreen } from './components/QuestionScreen';
import { ResultScreen } from './components/ResultScreen';
import { StartScreen } from './components/StartScreen';
import { loadBestScore, saveBestScore } from './game/bestScore';
import { useQuiz } from './game/useQuiz';

export default function App() {
  const { state, start, answer, next } = useQuiz();
  // The best score as it was when this game began, so the results screen knows if it was beaten.
  const [bestAtStart, setBestAtStart] = useState(loadBestScore);
  const bestScore = state.phase === 'finished' ? Math.max(bestAtStart, state.score) : bestAtStart;

  function startGame() {
    setBestAtStart(bestScore);
    start();
  }

  useEffect(() => {
    if (state.phase === 'finished' && state.score > bestAtStart) saveBestScore(state.score);
  }, [state.phase, state.score, bestAtStart]);

  const dateline =
    state.phase === 'playing'
      ? `Claim ${state.index + 1} of ${state.questions.length}`
      : state.phase === 'finished'
        ? 'Final Edition'
        : undefined;

  return (
    <main className="page">
      <Masthead dateline={dateline} compact={state.phase !== 'start'} />
      {state.phase === 'start' && <StartScreen bestScore={bestScore} onStart={startGame} />}
      {state.phase === 'playing' && <QuestionScreen state={state} onAnswer={answer} onNext={next} />}
      {state.phase === 'finished' && (
        <ResultScreen state={state} isNewBest={state.score > bestAtStart} onPlayAgain={startGame} />
      )}
    </main>
  );
}
