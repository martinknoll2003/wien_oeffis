import type { BoardSnapshot } from '@wien-oeffis/shared';

type BoardCardProps = {
  board: BoardSnapshot;
  favoriteLabel: string;
  onRefresh: () => void;
  onRemove: () => void;
};

const formatBoardTime = (value: string): string =>
  new Intl.DateTimeFormat('de-AT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));

const formatDepartureTime = (value: string): string =>
  new Intl.DateTimeFormat('de-AT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export const BoardCard = ({ board, favoriteLabel, onRefresh, onRemove }: BoardCardProps) => (
  <article className={`board-card ${board.isStale ? 'is-stale' : ''}`}>
    <div className="board-glow" aria-hidden="true" />
    <header className="board-header">
      <div className="board-titleblock">
        <p className="eyebrow">Live-Board</p>
        <h2>{favoriteLabel}</h2>
        <p className="board-subtitle">
          {board.title}
          <span>Stand {formatBoardTime(board.updatedAt)}</span>
        </p>
      </div>

      <div className="board-actions">
        {board.isStale ? <span className="status-pill warning">Zwischenspeicher</span> : null}
        <button type="button" className="ghost-button" onClick={onRefresh}>
          Aktualisieren
        </button>
        <button type="button" className="ghost-button danger" onClick={onRemove}>
          Entfernen
        </button>
      </div>
    </header>

    <div className="departures-grid">
      {board.platformGroups.map((group) => (
        <section key={`${group.lineName}-${group.platform}-${group.direction}-${group.rbl}`} className="line-panel">
          <div className="line-heading">
            <div className="line-badge-wrap">
              <p className="line-badge">{group.lineName}</p>
              <span className="platform-pill">Steig {group.platform ?? '–'}</span>
            </div>
            <div className="line-copy">
              <h3>{group.towards}</h3>
              <p>
                {group.direction ? `Richtung ${group.direction}` : 'Live-Abfahrten'}
                {group.rbl ? ` · RBL ${group.rbl}` : ''}
              </p>
            </div>
          </div>

          <ul className="departure-list">
            {group.departures.map((departure) => (
              <li
                key={`${group.lineName}-${departure.plannedTime}-${departure.realtimeTime ?? 'planned'}`}
                className={departure.countdownMinutes <= 2 ? 'departure-item urgent' : 'departure-item'}
              >
                <div className="departure-main">
                  <span className="countdown-block">
                    <span className="countdown">{departure.countdownMinutes}</span>
                    {' '}
                    <span className="countdown-unit">min</span>
                  </span>
                  <span className="clock">{formatDepartureTime(departure.realtimeTime ?? departure.plannedTime)}</span>
                </div>
                <div className="meta-row">
                  <span>{departure.isRealtime ? 'Echtzeit' : 'Planzeit'}</span>
                  {departure.barrierFree ? <span>barrierefrei</span> : null}
                  {departure.trafficjam ? <span>Verzögerung</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!board.platformGroups.length ? (
        <section className="line-panel empty">
          <h3>Keine Abfahrten</h3>
          <p>Für diese Haltestelle liegen aktuell keine zukünftigen Abfahrten vor.</p>
        </section>
      ) : null}
    </div>

    <footer className="alerts-panel">
      <div className="alerts-header">
        <p className="eyebrow">Hinweise</p>
        <h3>Störungen und Aufzüge</h3>
      </div>

      {board.alerts.length ? (
        <div className="alerts-list">
          {board.alerts.map((alert) => (
            <article key={alert.name} className="alert-card">
              <div className="alert-headline">
                <strong>{alert.title}</strong>
                <span className="status-pill">{alert.category}</span>
              </div>
              <p>{alert.description}</p>
              <p className="alert-meta">
                {alert.relatedLines.length ? `Linien ${alert.relatedLines.join(', ')}` : 'Allgemeiner Hinweis'}
                {alert.status ? ` · Status ${alert.status}` : ''}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="panel-note">Keine aktuellen Störungs- oder Aufzugsmeldungen.</p>
      )}
    </footer>
  </article>
);
