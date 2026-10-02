import { QUESTIONS_PER_GAME } from '../game/logic';

interface StartScreenProps {
  bestScore: number;
  onStart: () => void;
}

export function StartScreen({ bestScore, onStart }: StartScreenProps) {
  return (
    <section className="start">
      <p className="start__lede">
        {QUESTIONS_PER_GAME} strange claims about history, nature and space. Some are real, some are
        made up. Read each one and stamp it <strong className="ink-true">true</strong> or{' '}
        <strong className="ink-fake">fake</strong>.
      </p>

      <ul className="start__rules">
        <li>
          <span className="start__rule-head">100 points</span> for every claim you call correctly.
        </li>
        <li>
          <span className="start__rule-head">Streak bonus</span> of +25 for each one after that in a
          row, up to +100.
        </li>
        <li>
          <span className="start__rule-head">Keyboard</span> <kbd>T</kbd> true, <kbd>F</kbd> fake,{' '}
          <kbd>Enter</kbd> next.
        </li>
      </ul>

      <div className="start__actions">
        <button type="button" className="button button--primary" onClick={onStart} autoFocus>
          Start reading
        </button>
        {bestScore > 0 && (
          <p className="start__best">
            Your best: <strong>{bestScore.toLocaleString()}</strong>
          </p>
        )}
      </div>
    </section>
  );
}
