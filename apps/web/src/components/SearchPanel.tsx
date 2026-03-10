import type { FavoriteBoard, StopSearchResult } from '@wien-oeffis/shared';

type SearchPanelProps = {
  busy: boolean;
  error: string | null;
  favorites: FavoriteBoard[];
  query: string;
  results: StopSearchResult[];
  searching: boolean;
  onAdd: (stop: StopSearchResult) => void;
  onQueryChange: (nextValue: string) => void;
};

const modeLabels: Record<string, string> = {
  '0': 'Bahn',
  '1': 'Bahn',
  '2': 'U-Bahn',
  '4': 'Straßenbahn',
  '5': 'Bus',
  '10': 'Nightline',
};

export const SearchPanel = ({
  busy,
  error,
  favorites,
  query,
  results,
  searching,
  onAdd,
  onQueryChange,
}: SearchPanelProps) => (
  <section className="search-panel">
    <div className="search-copy">
      <p className="eyebrow">Favoriten bearbeiten</p>
      <h2>Neue Haltestelle anheften</h2>
      <p>
        Suche eine Wiener-Linien-Haltestelle und pinne sie als weiteres Live-Board auf dein Dashboard.
      </p>
    </div>

    <div className="search-interaction">
      <label className="search-field">
        <span>Haltestelle suchen</span>
        <input
          type="search"
          placeholder="z. B. Reumannplatz"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="search-status-row">
        {searching ? <p className="panel-note">Suche läuft…</p> : <p className="panel-note">DIVA-Suche über Wiener Linien</p>}
        {error ? <p className="panel-error">{error}</p> : null}
      </div>
    </div>

    <div className="search-results" role="list" aria-label="Suchergebnisse">
      {results.map((result) => {
        const isPinned = favorites.some((favorite) => favorite.diva === result.diva);

        return (
          <article key={result.diva} className="result-card" role="listitem">
            <div className="result-content">
              <p className="result-title">{result.name}</p>
              <p className="result-subtitle">{result.displayName}</p>
              <p className="result-modes">
                {(result.modes.length ? result.modes : ['5'])
                  .map((mode) => modeLabels[mode] ?? 'Öffi')
                  .join(' · ')}
              </p>
            </div>

            <button
              type="button"
              className="chip-button"
              onClick={() => onAdd(result)}
              disabled={busy || isPinned}
            >
              {isPinned ? 'Bereits angeheftet' : 'Anheften'}
            </button>
          </article>
        );
      })}

      {!results.length && query.trim().length >= 2 && !searching ? (
        <p className="panel-note">Keine passenden Haltestellen gefunden.</p>
      ) : null}
    </div>
  </section>
);
