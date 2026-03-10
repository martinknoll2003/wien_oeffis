import type { BoardsResponse, SearchResponse } from '@wien-oeffis/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

const jsonHeaders = {
  Accept: 'application/json',
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? 'Die Daten konnten nicht geladen werden.';
  } catch {
    return 'Die Daten konnten nicht geladen werden.';
  }
};

export const searchStops = async (query: string, signal?: AbortSignal): Promise<SearchResponse> => {
  const url = new URL(`${API_BASE}/stops/search`, window.location.origin);
  url.searchParams.set('q', query);

  const response = await fetch(url, {
    signal,
    headers: jsonHeaders,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as SearchResponse;
};

export const fetchBoards = async (divas: string[], signal?: AbortSignal): Promise<BoardsResponse> => {
  const url = new URL(`${API_BASE}/boards`, window.location.origin);
  for (const diva of divas) {
    url.searchParams.append('diva', diva);
  }

  const response = await fetch(url, {
    signal,
    headers: jsonHeaders,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as BoardsResponse;
};
