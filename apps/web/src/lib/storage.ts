import { DEFAULT_FAVORITES, favoriteBoardSchema, type FavoriteBoard } from '@wien-oeffis/shared';

const STORAGE_KEY = 'wien-oeffis:favorites';

export const loadFavorites = (): FavoriteBoard[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FAVORITES;
    }

    const parsed = JSON.parse(raw);
    const result = favoriteBoardSchema.array().safeParse(parsed);
    return result.success && result.data.length ? result.data : DEFAULT_FAVORITES;
  } catch {
    return DEFAULT_FAVORITES;
  }
};

export const saveFavorites = (favorites: FavoriteBoard[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
};
