import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

const boardPayload = {
  boards: [
    {
      diva: '60200001',
      title: 'Schrankenberggasse',
      updatedAt: '2026-03-10T21:00:00.000Z',
      isStale: false,
      platformGroups: [
        {
          rbl: 420,
          platform: '2',
          direction: 'R',
          lineName: '6',
          towards: 'Burggasse, Stadthalle U',
          departures: [
            {
              plannedTime: '2026-03-10T21:05:00.000Z',
              realtimeTime: '2026-03-10T21:06:00.000Z',
              countdownMinutes: 2,
              isRealtime: true,
              barrierFree: true,
              trafficjam: false,
            },
          ],
        },
      ],
      alerts: [],
    },
  ],
  updatedAt: '2026-03-10T21:00:00.000Z',
};

const searchPayload = {
  stops: [
    {
      diva: '60201095',
      name: 'Reumannplatz',
      place: 'Wien',
      displayName: 'Wien, Reumannplatz',
      modes: ['2', '4', '5'],
      coords: {
        lat: 48.1742503,
        lon: 16.3781651,
      },
    },
  ],
  updatedAt: '2026-03-10T21:00:00.000Z',
};

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('seeds default favorites and renders the initial board', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(boardPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Schrankenberggasse' })).toBeInTheDocument();
    expect(screen.getByText('Burggasse, Stadthalle U')).toBeInTheDocument();
  });

  it('adds and removes favorites while persisting them to localStorage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/stops/search')) {
        return Promise.resolve(
          new Response(JSON.stringify(searchPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      const divas = new URL(url).searchParams.getAll('diva');
      const boards = divas.map((diva) =>
        diva === '60201095'
          ? {
              ...boardPayload.boards[0],
              diva: '60201095',
              title: 'Reumannplatz',
            }
          : boardPayload.boards[0],
      );

      const payload = {
        ...boardPayload,
        boards,
      };

      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(<App />);
    await screen.findByRole('heading', { name: 'Schrankenberggasse' });

    await userEvent.type(screen.getByPlaceholderText('z. B. Reumannplatz'), 'Reumannplatz');
    await screen.findByText('Wien, Reumannplatz');

    await userEvent.click(screen.getByRole('button', { name: 'Anheften' }));

    expect(await screen.findByRole('heading', { name: 'Reumannplatz' })).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem('wien-oeffis:favorites') ?? '[]');
    expect(stored).toEqual([
      { diva: '60200001', label: 'Schrankenberggasse' },
      { diva: '60201095', label: 'Reumannplatz' },
    ]);

    await userEvent.click(screen.getAllByRole('button', { name: 'Entfernen' })[1]!);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Reumannplatz' })).not.toBeInTheDocument();
    });
  });

  it('renders grouped departures with urgent styling and stale badge', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ...boardPayload,
          boards: [
            {
              ...boardPayload.boards[0],
              isStale: true,
              alerts: [
                {
                  name: 'eD_23',
                  title: 'Aufzug derzeit außer Betrieb',
                  description: 'Bahnsteig Ri. Siebenhirten',
                  category: 'aufzugsinfo',
                  relatedLines: ['6'],
                  relatedStops: [420],
                  status: 'active',
                  modifiedAt: '2026-03-10T20:55:00.000Z',
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    render(<App />);

    expect(await screen.findByText('Zwischenspeicher')).toBeInTheDocument();
    expect(screen.getByText('Burggasse, Stadthalle U')).toBeInTheDocument();
    expect(screen.getByText('Aufzug derzeit außer Betrieb')).toBeInTheDocument();
  });

  it('shows loading and backend error states', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(JSON.stringify(boardPayload), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }, 25);
        }),
    );

    render(<App />);
    expect(screen.getByText('Boards werden geladen…')).toBeInTheDocument();

    await screen.findByRole('heading', { name: 'Schrankenberggasse' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: 'Die Wiener-Linien-Daten konnten nicht geladen werden.',
          },
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Jetzt aktualisieren' }));

    expect(await screen.findByText('Live-Daten derzeit nicht verfügbar.')).toBeInTheDocument();
  });

  it('opens focus mode and limits selection to two pinned boards', async () => {
    window.localStorage.setItem(
      'wien-oeffis:favorites',
      JSON.stringify([
        { diva: '60200001', label: 'Schrankenberggasse' },
        { diva: '60201095', label: 'Reumannplatz' },
        { diva: '60200123', label: 'Karlsplatz' },
      ]),
    );

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      const divas = new URL(url).searchParams.getAll('diva');
      const boards = divas.map((diva) =>
        diva === '60201095'
          ? {
              ...boardPayload.boards[0],
              diva: '60201095',
              title: 'Reumannplatz',
            }
          : diva === '60200123'
            ? {
                ...boardPayload.boards[0],
                diva: '60200123',
                title: 'Karlsplatz',
              }
            : boardPayload.boards[0],
      );

      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...boardPayload,
            boards,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    });

    render(<App />);
    await screen.findByRole('heading', { name: 'Schrankenberggasse' });

    expect(await screen.findByRole('heading', { name: 'Reumannplatz' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Karlsplatz' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fokusmodus' }));

    expect(await screen.findByRole('heading', { name: 'Ein oder zwei Boards, nur die nächsten Zeiten' })).toBeInTheDocument();

    const reumannplatzChip = screen.getByRole('button', { name: 'Reumannplatz' });
    const karlsplatzChip = screen.getByRole('button', { name: 'Karlsplatz' });

    expect(reumannplatzChip).not.toBeDisabled();
    expect(karlsplatzChip).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ein oder zwei Boards, nur die nächsten Zeiten' })).not.toBeInTheDocument();
    });
  });
});
