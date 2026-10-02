import { useEffect, useState, type FormEvent } from 'react';
import { fetchLeaderboard, submitScore, type LeaderboardEntry, type SubmitResult } from '../api/leaderboard';

const NAME_KEY = 'absurdly-true:player-name';
const NAME_MAX_LENGTH = 24;

function loadName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not important if it fails; the player just retypes their name next time.
  }
}

interface LeaderboardProps {
  score: number;
  correct: number;
}

type BoardState = { status: 'loading' } | { status: 'ready'; entries: LeaderboardEntry[] } | { status: 'offline' };

export function Leaderboard({ score, correct }: LeaderboardProps) {
  const [board, setBoard] = useState<BoardState>({ status: 'loading' });
  const [name, setName] = useState(loadName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeaderboard(10, controller.signal)
      .then((entries) => setBoard({ status: 'ready', entries }))
      .catch(() => {
        if (!controller.signal.aborted) setBoard({ status: 'offline' });
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await submitScore({ name: name.trim(), score, correct });
      saveName(name.trim());
      setSubmitted(result);
      setBoard({ status: 'ready', entries: await fetchLeaderboard(10) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your score.');
    } finally {
      setSaving(false);
    }
  }

  if (board.status === 'offline') {
    return (
      <section className="leaderboard" aria-labelledby="leaderboard-title">
        <h3 id="leaderboard-title" className="section-title">
          The Leaderboard
        </h3>
        <p className="leaderboard__note">The leaderboard is offline right now. Your best score is still saved on this device.</p>
      </section>
    );
  }

  const entries = board.status === 'ready' ? board.entries : [];
  const mine = submitted?.entry;
  const mineIsListed = mine ? entries.some((entry) => entry.id === mine.id) : false;

  return (
    <section className="leaderboard" aria-labelledby="leaderboard-title">
      <h3 id="leaderboard-title" className="section-title">
        The Leaderboard
      </h3>

      {submitted ? (
        <p className="leaderboard__note" role="status">
          Filed. You're <strong>No. {submitted.rank}</strong> on the board.
        </p>
      ) : (
        <form className="byline" onSubmit={handleSubmit}>
          <label htmlFor="byline-name" className="byline__label">
            Sign your byline to post {score.toLocaleString()} points
          </label>
          <div className="byline__row">
            <input
              id="byline-name"
              className="byline__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Your name"
              autoComplete="nickname"
              required
            />
            <button type="submit" className="button" disabled={saving || name.trim() === ''}>
              {saving ? 'Filing…' : 'Post score'}
            </button>
          </div>
          {error && (
            <p className="byline__error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {board.status === 'loading' ? (
        <p className="leaderboard__note">Fetching the latest standings…</p>
      ) : entries.length === 0 ? (
        <p className="leaderboard__note">No scores yet. Yours could be the first headline.</p>
      ) : (
        <ol className="standings">
          {entries.map((entry) => (
            <li key={entry.id} className="standings__row" data-mine={entry.id === mine?.id || undefined}>
              {/* Ties share a rank, matching the rank the API returns on submit. */}
              <span className="standings__rank">{entries.findIndex((e) => e.score === entry.score) + 1}</span>
              <span className="standings__name">{entry.name}</span>
              <span className="standings__score">{entry.score.toLocaleString()}</span>
            </li>
          ))}
          {mine && !mineIsListed && submitted && (
            <li className="standings__row standings__row--gap" data-mine>
              <span className="standings__rank">{submitted.rank}</span>
              <span className="standings__name">{mine.name}</span>
              <span className="standings__score">{mine.score.toLocaleString()}</span>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
