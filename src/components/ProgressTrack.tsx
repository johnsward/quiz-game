import type { AnswerRecord } from '../game/types';

interface ProgressTrackProps {
  total: number;
  current: number;
  answers: AnswerRecord[];
}

/** One tick per claim, marked right or wrong once answered. */
export function ProgressTrack({ total, current, answers }: ProgressTrackProps) {
  return (
    <ol className="track" aria-label={`Claim ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const answer = answers[i];
        const state = answer ? (answer.correct ? 'right' : 'wrong') : i === current ? 'current' : 'pending';
        return <li key={i} className="track__tick" data-state={state} />;
      })}
    </ol>
  );
}
