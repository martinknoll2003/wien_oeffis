import { DEFAULT_FAVORITES, type BoardSnapshot, type FavoriteBoard, type StopSearchResult } from '@wien-oeffis/shared';
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react';
import { fetchBoards, searchStops } from './lib/api';
import { loadFavorites, saveFavorites } from './lib/storage';
import { BoardCard } from './components/BoardCard';
import { FocusMode } from './components/FocusMode';
import { SearchPanel } from './components/SearchPanel';

const formatClock = (value: Date): string =>
  new Intl.DateTimeFormat('de-AT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);

export const App = () => {
  const [favorites, setFavorites] = useState<FavoriteBoard[]>(() =>
    typeof window === 'undefined' ? DEFAULT_FAVORITES : loadFavorites(),
  );
  const [boards, setBoards] = useState<BoardSnapshot[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StopSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === 'visible');
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [focusSelection, setFocusSelection] = useState<string[]>(() =>
    DEFAULT_FAVORITES.map((favorite) => favorite.diva).slice(0, 2),
  );
  const [fullscreenActive, setFullscreenActive] = useState(() => document.fullscreenElement !== null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setFullscreenActive(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleResize = () =>
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    setFocusSelection((current) => {
      const valid = current.filter((diva) => favorites.some((favorite) => favorite.diva === diva));
      if (valid.length >= 2) {
        return valid.slice(0, 2);
      }

      const fallback = favorites
        .map((favorite) => favorite.diva)
        .filter((diva) => !valid.includes(diva))
        .slice(0, Math.max(0, 2 - valid.length));

      return [...valid, ...fallback].slice(0, 2);
    });

    if (!favorites.length) {
      setFocusModeActive(false);
    }
  }, [favorites]);

  useEffect(() => {
    if (!favorites.length) {
      setBoards([]);
      setBoardsLoading(false);
      setBoardsError(null);
      return;
    }

    const controller = new AbortController();
    setBoardsLoading(!initialLoadDone.current);

    const run = async () => {
      try {
        const response = await fetchBoards(
          favorites.map((favorite) => favorite.diva),
          controller.signal,
        );

        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setBoards(response.boards);
          setBoardsError(null);
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setBoardsError(error instanceof Error ? error.message : 'Die Boards konnten nicht geladen werden.');
      } finally {
        if (!controller.signal.aborted) {
          initialLoadDone.current = true;
          setBoardsLoading(false);
        }
      }
    };

    void run();
    return () => controller.abort();
  }, [favorites, refreshCounter]);

  useEffect(() => {
    if (!favorites.length || !isVisible) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRefreshCounter((value) => value + 1);
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [favorites.length, isVisible]);

  useEffect(() => {
    if (deferredSearchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const run = async () => {
      try {
        const response = await searchStops(deferredSearchQuery.trim(), controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setSearchResults(response.stops);
          setSearchError(null);
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSearchError(error instanceof Error ? error.message : 'Die Suche ist fehlgeschlagen.');
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    };

    void run();
    return () => controller.abort();
  }, [deferredSearchQuery]);

  const favoriteByDiva = new Map(favorites.map((favorite) => [favorite.diva, favorite]));
  const boardByDiva = new Map(boards.map((board) => [board.diva, board]));
  const orderedBoards = favorites
    .map((favorite) => boardByDiva.get(favorite.diva))
    .filter((board): board is BoardSnapshot => Boolean(board));
  const focusBoards = orderedBoards.filter((board) => focusSelection.includes(board.diva)).slice(0, 2);
  const compactFocusMode = viewport.width <= 820 || viewport.height <= 900;
  const focusLineLimit =
    focusBoards.length <= 1 ? (compactFocusMode ? 2 : 3) : compactFocusMode ? 2 : 2;
  const focusDepartureLimit =
    focusBoards.length <= 1 ? (compactFocusMode ? 2 : 3) : compactFocusMode ? 2 : 2;

  const addFavorite = (result: StopSearchResult) => {
    setFavorites((current) => {
      if (current.some((favorite) => favorite.diva === result.diva)) {
        return current;
      }

      return [
        ...current,
        {
          diva: result.diva,
          label: result.name,
        },
      ];
    });
    setSearchQuery('');
    setSearchResults([]);
    setRefreshCounter((value) => value + 1);
  };

  const removeFavorite = (diva: string) => {
    setFavorites((current) => current.filter((favorite) => favorite.diva !== diva));
  };

  const refreshBoards = () => {
    setRefreshCounter((value) => value + 1);
  };

  const openFocusMode = () => {
    if (!favorites.length) {
      return;
    }

    setFocusSelection((current) =>
      current.length >= 2
        ? current.slice(0, 2)
        : [
            ...current,
            ...favorites
              .map((favorite) => favorite.diva)
              .filter((diva) => !current.includes(diva))
              .slice(0, Math.max(0, 2 - current.length)),
          ].slice(0, 2),
    );
    setFocusModeActive(true);
  };

  const closeFocusMode = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }

    setFocusModeActive(false);
  };

  const toggleFocusBoard = (diva: string) => {
    setFocusSelection((current) => {
      if (current.includes(diva)) {
        return current.length === 1 ? current : current.filter((entry) => entry !== diva);
      }

      return [...current, diva].slice(0, 2);
    });
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <main className="app-shell">
      <div className="background-grid" aria-hidden="true" />
      <header className="hero-panel">
        <div className="hero-copyblock">
          <p className="eyebrow">Wien Oeffis</p>
          <h1>Live-Abfahrten als Kiosk-Dashboard</h1>
          <p className="hero-copy">
            Pinned Lieblingshaltestellen, Echtzeit-Abfahrten, Störungen und Aufzugsinfos direkt aus der
            Wiener-Linien-OGD.
          </p>
          <div className="hero-meta" aria-label="Dashboard-Status">
            <span className="hero-chip">{favorites.length} Boards aktiv</span>
            <span className="hero-chip">Refresh alle 15 Sekunden</span>
            <span className={`hero-chip ${isVisible ? 'is-live' : 'is-muted'}`}>
              {isVisible ? 'Live-Modus' : 'Pausiert im Hintergrund'}
            </span>
          </div>
        </div>

        <div className="clock-panel">
          <p className="clock-label">Aktuelle Zeit</p>
          <strong>{formatClock(clock)}</strong>
          <p className="clock-copy">
            Optimiert für Wanddisplay, Desktop und schnelle Kontrollen am Handy.
          </p>
          <button type="button" className="chip-button" onClick={refreshBoards}>
            Jetzt aktualisieren
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={openFocusMode}
            disabled={!favorites.length}
          >
            Fokusmodus
          </button>
        </div>
      </header>

      <SearchPanel
        busy={boardsLoading}
        error={searchError}
        favorites={favorites}
        query={searchQuery}
        results={searchResults}
        searching={searching}
        onAdd={addFavorite}
        onQueryChange={setSearchQuery}
      />

      {boardsError ? (
        <section className="banner error" role="alert">
          <strong>Live-Daten derzeit nicht verfügbar.</strong>
          <span>{boardsError}</span>
        </section>
      ) : null}

      {boardsLoading ? (
        <section className="banner loading">
          <strong>Boards werden geladen…</strong>
          <span>Die aktuellen Abfahrten werden zusammengestellt.</span>
        </section>
      ) : null}

      {!boardsLoading && !favorites.length ? (
        <section className="empty-state">
          <p className="eyebrow">Noch leer</p>
          <h2>Keine Haltestellen angeheftet</h2>
          <p>Suche oben nach einer Haltestelle, um dein erstes Live-Board zu pinnen.</p>
        </section>
      ) : null}

      <section className="boards-layout">
        {orderedBoards.map((board) => (
          <BoardCard
            key={board.diva}
            board={board}
            favoriteLabel={favoriteByDiva.get(board.diva)?.label ?? board.title}
            onRefresh={refreshBoards}
            onRemove={() => removeFavorite(board.diva)}
          />
        ))}
      </section>

      <FocusMode
        active={focusModeActive}
        boards={focusBoards}
        clockLabel={formatClock(clock)}
        compact={compactFocusMode}
        error={boardsError}
        favorites={favorites}
        fullscreenActive={fullscreenActive}
        lineLimit={focusLineLimit}
        loading={boardsLoading}
        departureLimit={focusDepartureLimit}
        selectedDivas={focusSelection}
        onClose={() => {
          void closeFocusMode();
        }}
        onToggleBoard={toggleFocusBoard}
        onToggleFullscreen={() => {
          void toggleFullscreen();
        }}
      />
    </main>
  );
};
