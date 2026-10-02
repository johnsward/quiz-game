CREATE TABLE scores (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
  score       INTEGER     NOT NULL CHECK (score >= 0),
  correct     INTEGER     NOT NULL CHECK (correct >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scores_leaderboard_idx ON scores (score DESC, created_at ASC);
