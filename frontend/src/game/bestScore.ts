const KEY = 'absurdly-true:best-score';

export function loadBestScore(): number {
  try {
    const value = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(KEY, String(score));
  } catch {
    // Storage may be unavailable (private mode, blocked). The game still works.
  }
}
