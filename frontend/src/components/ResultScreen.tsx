import { getRank } from '../game/logic';
import type { QuizState } from '../game/types';
import { Leaderboard } from './Leaderboard';

interface ResultScreenProps {
  state: QuizState;
  isNewBest: boolean;
  onPlayAgain: () => void;
}

export function ResultScreen({ state, isNewBest, onPlayAgain }: ResultScreenProps) {
  const { answers, score, bestStreak } = state;
  const correct = answers.filter((a) => a.correct).length;
  const rank = getRank(correct, answers.length);

  return (
    <section className="results">
      <p className="kicker">Your rank</p>
      <h2 className="results__rank">{rank.title}</h2>
      <p className="results__blurb">{rank.blurb}</p>

      <dl className="stats">
        <div className="stats__item">
          <dt>Score</dt>
          <dd>{score.toLocaleString()}</dd>
        </div>
        <div className="stats__item">
          <dt>Correct</dt>
          <dd>
            {correct}
            <span className="stats__of">/{answers.length}</span>
          </dd>
        </div>
        <div className="stats__item">
          <dt>Streak</dt>
          <dd>{bestStreak}</dd>
        </div>
      </dl>
      {isNewBest && <p className="results__new-best">New personal best</p>}

      <div className="results__actions">
        <button type="button" className="button button--primary" onClick={onPlayAgain} autoFocus>
          Play a new edition
        </button>
      </div>

      <Leaderboard score={score} correct={correct} />

      <h3 className="section-title">Corrections &amp; clarifications</h3>
      <ol className="review">
        {answers.map(({ question, correct: right }) => (
          <li key={question.id} className="review__item">
            <span className={right ? 'review__mark ink-true' : 'review__mark ink-fake'}>
              {right ? '✓' : '✗'}
              <span className="visually-hidden">{right ? 'You got this right' : 'You got this wrong'}</span>
            </span>
            <span className="review__claim">{question.claim}</span>
            <span className={question.isTrue ? 'review__truth ink-true' : 'review__truth ink-fake'}>
              {question.isTrue ? 'True' : 'Fake'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
