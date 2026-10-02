import { useEffect, useRef } from 'react';
import type { QuizState } from '../game/types';
import { ProgressTrack } from './ProgressTrack';
import { Stamp } from './Stamp';

interface QuestionScreenProps {
  state: QuizState;
  onAnswer: (guess: boolean) => void;
  onNext: () => void;
}

export function QuestionScreen({ state, onAnswer, onNext }: QuestionScreenProps) {
  const { questions, index, answers, score, streak } = state;
  const question = questions[index];
  const answer = answers[index];
  const isLast = index === questions.length - 1;

  const claimRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Move focus to the new claim, then to "Next" once it's answered.
  useEffect(() => claimRef.current?.focus(), [index]);
  useEffect(() => {
    if (answer) nextRef.current?.focus();
  }, [answer]);

  // T / F shortcuts. "Next" needs no shortcut: it's focused after answering, so Enter presses it.
  useEffect(() => {
    if (answer) return;
    function handleKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === 't') onAnswer(true);
      if (key === 'f') onAnswer(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [answer, onAnswer]);

  return (
    <section className="play">
      <div className="play__status">
        <ProgressTrack total={questions.length} current={index} answers={answers} />
        <div className="play__score">
          <span className="play__score-value">{score.toLocaleString()}</span>
          <span className="play__score-label">
            {streak >= 2 ? `pts · ${streak} in a row` : 'pts'}
          </span>
        </div>
      </div>

      <article className="claim" data-verdict={answer ? (answer.correct ? 'right' : 'wrong') : undefined}>
        <p className="kicker">Claim No. {index + 1}</p>
        <h2 ref={claimRef} tabIndex={-1} className="claim__text">
          {question.claim}
        </h2>
        {answer && <Stamp key={question.id} isTrue={question.isTrue} />}
      </article>

      <div className="choices" role="group" aria-label="Your verdict">
        {[true, false].map((guess) => (
          <button
            key={String(guess)}
            type="button"
            className={`choice choice--${guess ? 'true' : 'fake'}`}
            data-picked={answer?.guess === guess || undefined}
            disabled={Boolean(answer)}
            onClick={() => onAnswer(guess)}
          >
            {guess ? 'True' : 'Fake'}
            <kbd>{guess ? 'T' : 'F'}</kbd>
          </button>
        ))}
      </div>

      <div className="reveal-slot" aria-live="polite">
        {answer && (
          <div className="reveal" key={question.id}>
            <p className={answer.correct ? 'reveal__verdict ink-true' : 'reveal__verdict ink-fake'}>
              {answer.correct ? `Correct. +${answer.points} points` : `Not quite. It's ${question.isTrue ? 'true' : 'fake'}.`}
            </p>
            <p className="reveal__explanation">{question.explanation}</p>
            <button ref={nextRef} type="button" className="button button--primary" onClick={onNext}>
              {isLast ? 'See your results' : 'Next claim'}
              <span aria-hidden="true"> →</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
