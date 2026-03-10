import { z } from 'zod';

export const TRAFFIC_INFO_CATEGORIES = [
  'stoerunglang',
  'stoerungkurz',
  'aufzugsinfo',
  'fahrtreppeninfo',
  'information',
] as const;

export const favoriteBoardSchema = z.object({
  diva: z.string().min(1),
  label: z.string().min(1),
});

export type FavoriteBoard = z.infer<typeof favoriteBoardSchema>;

export const coordsSchema = z.object({
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

export type Coords = z.infer<typeof coordsSchema>;

export const stopSearchResultSchema = z.object({
  diva: z.string().min(1),
  name: z.string().min(1),
  place: z.string().min(1),
  displayName: z.string().min(1),
  modes: z.array(z.string()),
  coords: coordsSchema,
});

export type StopSearchResult = z.infer<typeof stopSearchResultSchema>;

export const departureSchema = z.object({
  plannedTime: z.string().datetime(),
  realtimeTime: z.string().datetime().nullable(),
  countdownMinutes: z.number().int().nonnegative(),
  isRealtime: z.boolean(),
  barrierFree: z.boolean(),
  trafficjam: z.boolean(),
});

export type Departure = z.infer<typeof departureSchema>;

export const platformGroupSchema = z.object({
  rbl: z.number().int().nullable(),
  platform: z.string().nullable(),
  direction: z.string().nullable(),
  lineName: z.string().min(1),
  towards: z.string().min(1),
  departures: z.array(departureSchema),
});

export type PlatformGroup = z.infer<typeof platformGroupSchema>;

export const trafficAlertSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  relatedLines: z.array(z.string()),
  relatedStops: z.array(z.number().int()),
  status: z.string().nullable(),
  modifiedAt: z.string().datetime().nullable(),
});

export type TrafficAlert = z.infer<typeof trafficAlertSchema>;

export const boardSnapshotSchema = z.object({
  diva: z.string().min(1),
  title: z.string().min(1),
  updatedAt: z.string().datetime(),
  platformGroups: z.array(platformGroupSchema),
  alerts: z.array(trafficAlertSchema),
  isStale: z.boolean(),
});

export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>;

export const boardsResponseSchema = z.object({
  boards: z.array(boardSnapshotSchema),
  updatedAt: z.string().datetime(),
});

export type BoardsResponse = z.infer<typeof boardsResponseSchema>;

export const searchResponseSchema = z.object({
  stops: z.array(stopSearchResultSchema),
  updatedAt: z.string().datetime(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(12).default(8),
});

export const boardsQuerySchema = z.object({
  diva: z.array(z.string().trim().min(1)).min(1).max(12),
  limit: z.coerce.number().int().min(1).max(8).default(4),
});

export const DEFAULT_FAVORITES: FavoriteBoard[] = [
  {
    diva: '60200001',
    label: 'Schrankenberggasse',
  },
];
