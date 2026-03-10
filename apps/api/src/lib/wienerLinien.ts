import type {
  BoardSnapshot,
  BoardsResponse,
  Departure,
  PlatformGroup,
  SearchResponse,
  StopSearchResult,
  TrafficAlert,
} from '@wien-oeffis/shared';
import { TRAFFIC_INFO_CATEGORIES } from '@wien-oeffis/shared';
import { TtlCache } from './cache';
import { UpstreamServiceError } from './errors';

type FetchLike = typeof fetch;

type ServiceOptions = {
  fetchFn?: FetchLike;
  now?: () => Date;
};

type RawStopFinderPoint = {
  anyType?: string;
  type?: string;
  name?: string;
  object?: string;
  mainLoc?: string;
  modes?: string;
  stateless?: string;
  ref?: {
    id?: string;
    coords?: string;
  };
};

type RawMonitorLine = {
  name?: string;
  towards?: string;
  direction?: string;
  platform?: string;
  barrierFree?: boolean;
  trafficjam?: boolean;
  departures?: {
    departure?: RawDeparture | RawDeparture[];
  };
};

type RawDeparture = {
  departureTime?: {
    timePlanned?: string;
    timeReal?: string;
    countdown?: number;
  };
  vehicle?: {
    barrierFree?: boolean;
    trafficjam?: boolean;
  };
};

type RawMonitor = {
  locationStop?: {
    properties?: {
      title?: string;
      attributes?: {
        rbl?: number;
      };
    };
  };
  lines?: RawMonitorLine | RawMonitorLine[];
};

type RawTrafficInfo = {
  name?: string;
  title?: string;
  description?: string;
  descriptionHTML?: string;
  refTrafficInfoCategoryId?: number;
  attributes?: {
    relatedLines?: string[];
    relatedStops?: number[];
  };
  status?: string;
  time?: {
    created?: string;
    lastupdate?: string;
  };
};

const REALTIME_BASE = 'https://www.wienerlinien.at/ogd_realtime/';
const ROUTING_BASE = 'https://www.wienerlinien.at/ogd_routing/';
const SEARCH_TTL_MS = 10 * 60 * 1000;
const BOARDS_TTL_MS = 15 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

const CATEGORY_NAMES = new Map<number, string>([
  [1, 'stoerunglang'],
  [2, 'stoerungkurz'],
  [3, 'aufzugsinfo'],
  [4, 'fahrtreppeninfo'],
  [5, 'information'],
]);

const asArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return value == null ? [] : [value];
};

const normalizeIso = (value: string): string =>
  value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

const parseDate = (value: string | undefined | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(normalizeIso(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseCoords = (value: string | undefined): { lat: number | null; lon: number | null } => {
  if (!value?.includes(',')) {
    return {
      lat: null,
      lon: null,
    };
  }

  const [lonRaw, latRaw] = value.split(',');
  const lon = Number(lonRaw) / 10_000_000;
  const lat = Number(latRaw) / 10_000_000;

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
};

const sortPlatformGroups = (left: PlatformGroup, right: PlatformGroup): number => {
  const leftCountdown = left.departures[0]?.countdownMinutes ?? Number.MAX_SAFE_INTEGER;
  const rightCountdown = right.departures[0]?.countdownMinutes ?? Number.MAX_SAFE_INTEGER;

  if (leftCountdown !== rightCountdown) {
    return leftCountdown - rightCountdown;
  }

  return left.lineName.localeCompare(right.lineName, 'de');
};

const sortAlerts = (left: TrafficAlert, right: TrafficAlert): number =>
  left.title.localeCompare(right.title, 'de');

const responseIsOk = (response: Response): boolean => response.ok;

export const createWienerLinienService = ({ fetchFn = fetch, now = () => new Date() }: ServiceOptions = {}) => {
  const searchCache = new TtlCache<SearchResponse>();
  const boardCache = new TtlCache<BoardSnapshot>();

  const fetchJson = async <T>(url: URL): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!responseIsOk(response)) {
        throw new UpstreamServiceError(`Wiener Linien antwortete mit ${response.status}.`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof UpstreamServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new UpstreamServiceError('Die Wiener-Linien-Anfrage hat das Zeitlimit überschritten.', 504, 'UPSTREAM_TIMEOUT');
      }

      throw new UpstreamServiceError('Die Wiener-Linien-Daten konnten nicht geladen werden.');
    } finally {
      clearTimeout(timeout);
    }
  };

  const searchStops = async (query: string, limit: number): Promise<SearchResponse> => {
    const cacheKey = `${query.toLowerCase()}::${limit}`;
    const cached = searchCache.getFresh(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL('XML_STOPFINDER_REQUEST', ROUTING_BASE);
    url.searchParams.set('locationServerActive', '1');
    url.searchParams.set('outputFormat', 'JSON');
    url.searchParams.set('type_sf', 'any');
    url.searchParams.set('name_sf', query);

    const payload = await fetchJson<{ stopFinder?: { points?: { point?: RawStopFinderPoint | RawStopFinderPoint[] } } }>(url);

    const stops = asArray(payload.stopFinder?.points?.point)
      .filter((point) => (point.anyType ?? point.type) === 'stop')
      .map<StopSearchResult | null>((point) => {
        const diva = point.ref?.id ?? point.stateless;
        if (!diva) {
          return null;
        }

        const objectName = point.object ?? point.name ?? 'Unbekannte Haltestelle';
        const place = point.mainLoc ?? 'Wien';

        return {
          diva,
          name: objectName,
          place,
          displayName: point.name ?? `${place}, ${objectName}`,
          modes: point.modes?.split(',').filter(Boolean) ?? [],
          coords: parseCoords(point.ref?.coords),
        };
      })
      .filter((point): point is StopSearchResult => point !== null)
      .slice(0, limit);

    const response: SearchResponse = {
      stops,
      updatedAt: now().toISOString(),
    };

    searchCache.set(cacheKey, response, SEARCH_TTL_MS);
    return response;
  };

  const fetchTrafficInfo = async (relatedStops: number[], relatedLines: string[]): Promise<TrafficAlert[]> => {
    if (!relatedStops.length && !relatedLines.length) {
      return [];
    }

    const url = new URL('trafficInfoList', REALTIME_BASE);
    for (const stop of relatedStops) {
      url.searchParams.append('relatedStop', String(stop));
    }
    for (const line of relatedLines) {
      url.searchParams.append('relatedLine', line);
    }
    for (const name of TRAFFIC_INFO_CATEGORIES) {
      url.searchParams.append('name', name);
    }

    const payload = await fetchJson<{ data?: { trafficInfos?: RawTrafficInfo | RawTrafficInfo[] } }>(url);
    const deduped = new Map<string, TrafficAlert>();

    for (const info of asArray(payload.data?.trafficInfos)) {
      if (!info.name || !info.title) {
        continue;
      }

      deduped.set(info.name, {
        name: info.name,
        title: info.title,
        description: info.description ?? info.descriptionHTML ?? 'Keine Details vorhanden.',
        category: CATEGORY_NAMES.get(info.refTrafficInfoCategoryId ?? 0) ?? 'information',
        relatedLines: info.attributes?.relatedLines ?? [],
        relatedStops: info.attributes?.relatedStops ?? [],
        status: info.status ?? null,
        modifiedAt: parseDate(info.time?.lastupdate ?? info.time?.created)?.toISOString() ?? null,
      });
    }

    return [...deduped.values()].sort(sortAlerts);
  };

  const normalizeDepartures = (line: RawMonitorLine, limit: number, currentTime: Date): Departure[] =>
    asArray(line.departures?.departure)
      .map<Departure | null>((departure) => {
        const plannedDate = parseDate(departure.departureTime?.timePlanned);
        const realtimeDate = parseDate(departure.departureTime?.timeReal);
        const activeDate = realtimeDate ?? plannedDate;

        if (!plannedDate || !activeDate || activeDate.getTime() < currentTime.getTime()) {
          return null;
        }

        const countdownMinutes = Math.max(
          0,
          Math.ceil((activeDate.getTime() - currentTime.getTime()) / 60_000),
        );

        return {
          plannedTime: plannedDate.toISOString(),
          realtimeTime: realtimeDate?.toISOString() ?? null,
          countdownMinutes,
          isRealtime: Boolean(realtimeDate),
          barrierFree: departure.vehicle?.barrierFree ?? line.barrierFree ?? false,
          trafficjam: departure.vehicle?.trafficjam ?? line.trafficjam ?? false,
        };
      })
      .filter((departure): departure is Departure => departure !== null)
      .sort((left, right) => left.countdownMinutes - right.countdownMinutes)
      .slice(0, limit);

  const buildBoard = async (diva: string, limit: number): Promise<BoardSnapshot> => {
    const cacheKey = `${diva}::${limit}`;
    const currentTime = now();
    const fresh = boardCache.getFresh(cacheKey);
    if (fresh) {
      return fresh;
    }

    try {
      const url = new URL('monitor', REALTIME_BASE);
      url.searchParams.set('diva', diva);
      url.searchParams.set('aArea', '1');
      for (const category of TRAFFIC_INFO_CATEGORIES) {
        url.searchParams.append('activateTrafficInfo', category);
      }

      const payload = await fetchJson<{
        data?: { monitors?: RawMonitor | RawMonitor[] };
        message?: { serverTime?: string };
      }>(url);

      const monitors = asArray(payload.data?.monitors);
      if (!monitors.length) {
        throw new UpstreamServiceError(`Keine Monitor-Daten für DIVA ${diva} gefunden.`, 404, 'BOARD_NOT_FOUND');
      }

      const relatedStops = new Set<number>();
      const relatedLines = new Set<string>();
      const platformGroups: PlatformGroup[] = [];

      for (const monitor of monitors) {
        const rbl = monitor.locationStop?.properties?.attributes?.rbl ?? null;
        if (rbl !== null) {
          relatedStops.add(rbl);
        }

        for (const line of asArray(monitor.lines)) {
          if (!line.name || !line.towards) {
            continue;
          }

          relatedLines.add(line.name);
          const departures = normalizeDepartures(line, limit, currentTime);
          if (!departures.length) {
            continue;
          }

          platformGroups.push({
            rbl,
            platform: line.platform ?? null,
            direction: line.direction ?? null,
            lineName: line.name,
            towards: line.towards,
            departures,
          });
        }
      }

      const alerts = await fetchTrafficInfo([...relatedStops], [...relatedLines]);
      const updatedAt = parseDate(payload.message?.serverTime)?.toISOString() ?? currentTime.toISOString();
      const board: BoardSnapshot = {
        diva,
        title: monitors[0]?.locationStop?.properties?.title ?? `Haltestelle ${diva}`,
        updatedAt,
        platformGroups: platformGroups.sort(sortPlatformGroups),
        alerts,
        isStale: false,
      };

      boardCache.set(cacheKey, board, BOARDS_TTL_MS, currentTime.getTime());
      return board;
    } catch (error) {
      const fallback = boardCache.getAny(cacheKey);
      if (fallback) {
        return {
          ...fallback,
          isStale: true,
        };
      }

      throw error;
    }
  };

  const getBoards = async (divas: string[], limit: number): Promise<BoardsResponse> => {
    const boards = await Promise.all(divas.map((diva) => buildBoard(diva, limit)));

    return {
      boards,
      updatedAt: now().toISOString(),
    };
  };

  return {
    searchStops,
    getBoards,
  };
};
