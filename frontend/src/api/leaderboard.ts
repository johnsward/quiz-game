export interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  correct: number;
  createdAt: string;
}

export interface SubmitResult {
  entry: LeaderboardEntry;
  rank: number;
}

// Same origin in every environment: Vite proxies /api in dev, nginx does in Docker.
const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${res.status})`);
  }
  return body as T;
}

export async function fetchLeaderboard(limit = 10, signal?: AbortSignal): Promise<LeaderboardEntry[]> {
  const { entries } = await request<{ entries: LeaderboardEntry[] }>(`/leaderboard?limit=${limit}`, { signal });
  return entries;
}

export function submitScore(input: { name: string; score: number; correct: number }): Promise<SubmitResult> {
  return request<SubmitResult>('/scores', { method: 'POST', body: JSON.stringify(input) });
}
