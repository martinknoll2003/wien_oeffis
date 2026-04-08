import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { createWienerLinienService } from './lib/wienerLinien';

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('WienerLinien service', () => {
  it('targets the documented Wiener Linien endpoints', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        stopFinder: {
          points: {
            point: [],
          },
        },
      }),
    );

    const service = createWienerLinienService({ fetchFn });
    await service.searchStops('Reumannplatz', 8);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain('/ogd_routing/XML_STOPFINDER_REQUEST');
  });

  it('normalizes stop search results from single-object and array payloads', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          stopFinder: {
            points: {
              point: {
                anyType: 'stop',
                name: 'Wien, Schrankenberggasse',
                object: 'Schrankenberggasse',
                mainLoc: 'Wien',
                modes: '4,5',
                ref: {
                  id: '60200001',
                  coords: '163890616,481739148',
                },
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          stopFinder: {
            points: {
              point: [
                {
                  anyType: 'address',
                },
                {
                  anyType: 'stop',
                  name: 'Wien, Reumannplatz',
                  object: 'Reumannplatz',
                  mainLoc: 'Wien',
                  modes: '2,4,5',
                  ref: {
                    id: '60201095',
                    coords: '163781651,481742503',
                  },
                },
              ],
            },
          },
        }),
      );

    const service = createWienerLinienService({ fetchFn });
    const first = await service.searchStops('Schrankenbergasse', 8);
    const second = await service.searchStops('Reumannplatz', 8);

    expect(first.stops).toEqual([
      {
        diva: '60200001',
        name: 'Schrankenberggasse',
        place: 'Wien',
        displayName: 'Wien, Schrankenberggasse',
        modes: ['4', '5'],
        coords: {
          lat: 48.1739148,
          lon: 16.3890616,
        },
      },
    ]);

    expect(second.stops).toHaveLength(1);
    expect(second.stops[0]?.diva).toBe('60201095');
  });

  it('aggregates board data, prefers realtime departures, and deduplicates alerts', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            monitors: [
              {
                locationStop: {
                  properties: {
                    title: 'Schrankenberggasse',
                    attributes: {
                      rbl: 406,
                    },
                  },
                },
                lines: {
                  name: '11',
                  towards: 'Kaiserebersdorf, Zinnergasse',
                  direction: 'H',
                  platform: '1',
                  barrierFree: true,
                  departures: {
                    departure: [
                      {
                        departureTime: {
                          timePlanned: '2026-03-10T22:05:00.000+0100',
                          timeReal: '2026-03-10T22:06:00.000+0100',
                        },
                        vehicle: {
                          barrierFree: true,
                          trafficjam: false,
                        },
                      },
                      {
                        departureTime: {
                          timePlanned: '2026-03-10T22:17:00.000+0100',
                          timeReal: '2026-03-10T22:18:00.000+0100',
                        },
                        vehicle: {
                          barrierFree: true,
                          trafficjam: false,
                        },
                      },
                    ],
                  },
                },
              },
              {
                locationStop: {
                  properties: {
                    title: 'Schrankenberggasse',
                    attributes: {
                      rbl: 420,
                    },
                  },
                },
                lines: {
                  name: '6',
                  towards: 'Burggasse, Stadthalle U',
                  direction: 'R',
                  platform: '2',
                  barrierFree: true,
                  departures: {
                    departure: {
                      departureTime: {
                        timePlanned: '2026-03-10T22:09:00.000+0100',
                        timeReal: '2026-03-10T22:10:00.000+0100',
                      },
                      vehicle: {
                        barrierFree: true,
                        trafficjam: true,
                      },
                    },
                  },
                },
              },
            ],
          },
          message: {
            serverTime: '2026-03-10T22:00:00.000+0100',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            trafficInfos: [
              {
                name: 'eD_23',
                title: 'Aufzug derzeit außer Betrieb',
                description: 'Bahnsteig Ri. Siebenhirten',
                refTrafficInfoCategoryId: 3,
                attributes: {
                  relatedLines: ['6'],
                  relatedStops: [420],
                },
                status: 'active',
                time: {
                  lastupdate: '2026-03-10T21:55:00.000+0100',
                },
              },
              {
                name: 'eD_23',
                title: 'Aufzug derzeit außer Betrieb',
                description: 'Bahnsteig Ri. Siebenhirten',
                refTrafficInfoCategoryId: 3,
                attributes: {
                  relatedLines: ['6'],
                  relatedStops: [420],
                },
                status: 'active',
                time: {
                  lastupdate: '2026-03-10T21:55:00.000+0100',
                },
              },
            ],
          },
        }),
      );

    const service = createWienerLinienService({
      fetchFn,
      now: () => new Date('2026-03-10T20:59:00.000Z'),
    });

    const response = await service.getBoards(['60200001'], 4);
    const board = response.boards[0];

    expect(board?.title).toBe('Schrankenberggasse');
    expect(board?.platformGroups).toHaveLength(2);
    expect(board?.platformGroups[0]?.departures[0]?.countdownMinutes).toBe(7);
    expect(board?.platformGroups[1]?.departures[0]?.trafficjam).toBe(true);
    expect(board?.alerts).toHaveLength(1);
    expect(board?.alerts[0]?.category).toBe('aufzugsinfo');
  });

  it('falls back to stale cache when the upstream board request fails', async () => {
    let currentNow = new Date('2026-03-10T20:59:00.000Z');
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            monitors: {
              locationStop: {
                properties: {
                  title: 'Schrankenberggasse',
                  attributes: {
                    rbl: 406,
                  },
                },
              },
              lines: {
                name: '11',
                towards: 'Kaiserebersdorf, Zinnergasse',
                platform: '1',
                departures: {
                  departure: {
                    departureTime: {
                      timePlanned: '2026-03-10T22:12:00.000+0100',
                    },
                  },
                },
              },
            },
          },
          message: {
            serverTime: '2026-03-10T22:00:00.000+0100',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { trafficInfos: [] } }))
      .mockRejectedValueOnce(new Error('network down'));

    const service = createWienerLinienService({
      fetchFn,
      now: () => currentNow,
    });

    const fresh = await service.getBoards(['60200001'], 3);
    currentNow = new Date('2026-03-10T21:00:16.000Z');
    const stale = await service.getBoards(['60200001'], 3);

    expect(fresh.boards[0]?.isStale).toBe(false);
    expect(stale.boards[0]?.isStale).toBe(true);
  });
});

describe('API app', () => {
  it('returns stable JSON errors when upstream calls fail', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'));
    const app = createApp({ fetchFn });

    const response = await app.request('/api/boards?diva=60200001');

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'Die Wiener-Linien-Daten konnten nicht geladen werden.',
      },
    });
  });
});
