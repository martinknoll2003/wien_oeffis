import type { BoardSnapshot, FavoriteBoard } from '@wien-oeffis/shared';

type FocusModeProps = {
  active: boolean;
  boards: BoardSnapshot[];
  clockLabel: string;
  compact: boolean;
  error: string | null;
  favorites: FavoriteBoard[];
  fullscreenActive: boolean;
  lineLimit: number;
  loading: boolean;
  departureLimit: number;
  selectedDivas: string[];
  onClose: () => void;
  onToggleBoard: (diva: string) => void;
  onToggleFullscreen: () => void;
};

const formatTime = (value: string): string =>
  new Intl.DateTimeFormat('de-AT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export const FocusMode = ({
  active,
  boards,
  clockLabel,
  compact,
  error,
  favorites,
  fullscreenActive,
  lineLimit,
  loading,
  departureLimit,
  selectedDivas,
  onClose,
  onToggleBoard,
  onToggleFullscreen,
}: FocusModeProps) => {
  if (!active) {
    return null;
  }

  return (
    <section className="focus-shell" aria-label="Fokusmodus">
      <div className="focus-backdrop" aria-hidden="true" />

      <div className="focus-toolbar">
        <div>
          <p className="eyebrow">Fokusmodus</p>
          <h2>Ein oder zwei Boards, nur die nächsten Zeiten</h2>
          <p className="focus-clock">{clockLabel}</p>
        </div>

        <div className="focus-actions">
          <button type="button" className="ghost-button" onClick={onToggleFullscreen}>
            {fullscreenActive ? 'Vollbild verlassen' : 'Vollbild starten'}
          </button>
          <button type="button" className="ghost-button danger" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>

      <div className="focus-selector" role="list" aria-label="Ausgewählte Favoriten">
        {favorites.map((favorite) => {
          const selected = selectedDivas.includes(favorite.diva);
          const blocked = !selected && selectedDivas.length >= 2;

          return (
            <button
              key={favorite.diva}
              type="button"
              className={`focus-chip ${selected ? 'is-selected' : ''}`}
              onClick={() => onToggleBoard(favorite.diva)}
              disabled={blocked}
            >
              {favorite.label}
            </button>
          );
        })}
      </div>

      {loading ? <p className="focus-note">Live-Daten werden geladen…</p> : null}
      {error ? <p className="focus-error">{error}</p> : null}

      <div className={`focus-layout ${boards.length === 1 ? 'single' : ''} ${compact ? 'compact' : ''}`}>
        {boards.map((board) => (
          <article key={board.diva} className={`focus-board ${board.isStale ? 'is-stale' : ''}`}>
            <header className="focus-board-header">
              <div>
                <p className="focus-board-title">{favorites.find((favorite) => favorite.diva === board.diva)?.label ?? board.title}</p>
                <p className="focus-board-subtitle">{board.title}</p>
              </div>
              <div className="focus-board-meta">
                {board.isStale ? <span className="status-pill warning">Zwischenspeicher</span> : null}
                <span className="status-pill">Stand {formatTime(board.updatedAt)}</span>
              </div>
            </header>

            <div className="focus-lines">
              {board.platformGroups.slice(0, lineLimit).map((group) => (
                <section
                  key={`${board.diva}-${group.lineName}-${group.platform}-${group.direction}-${group.rbl}`}
                  className="focus-line"
                >
                  <div className="focus-line-header">
                    <div className="focus-line-left">
                      <span className="focus-line-badge">{group.lineName}</span>
                      <div>
                        <h3>{group.towards}</h3>
                        <p>
                          Steig {group.platform ?? '–'}
                          {group.direction ? ` · Richtung ${group.direction}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="focus-departures">
                    {group.departures.slice(0, departureLimit).map((departure) => (
                      <article
                        key={`${group.lineName}-${departure.plannedTime}-${departure.realtimeTime ?? 'planned'}`}
                        className={`focus-departure ${departure.countdownMinutes <= 2 ? 'urgent' : ''}`}
                      >
                        <span className="focus-countdown">{departure.countdownMinutes}</span>
                        <span className="focus-countdown-unit">min</span>
                        <span className="focus-exact-time">
                          {formatTime(departure.realtimeTime ?? departure.plannedTime)}
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
