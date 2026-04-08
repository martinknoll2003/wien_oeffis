import { boardsQuerySchema, searchQuerySchema } from '@wien-oeffis/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { UpstreamServiceError } from './lib/errors';
import { createWienerLinienService } from './lib/wienerLinien';

type AppOptions = Parameters<typeof createWienerLinienService>[0];

const jsonError = (code: string, message: string) => ({
  error: {
    code,
    message,
  },
});

export const createApp = (options: AppOptions = {}) => {
  const service = createWienerLinienService(options);
  const app = new Hono();

  app.use('/api/*', cors());

  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      timestamp: new Date().toISOString(),
    }),
  );

  app.get('/api/stops/search', async (c) => {
    try {
      const { q, limit } = searchQuerySchema.parse({
        q: c.req.query('q'),
        limit: c.req.query('limit') ?? undefined,
      });

      return c.json(await service.searchStops(q, limit));
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(jsonError('VALIDATION_ERROR', 'Bitte gib mindestens zwei Zeichen für die Suche ein.'), 400);
      }

      if (error instanceof UpstreamServiceError) {
        return c.json(jsonError(error.code, error.message), error.status);
      }

      return c.json(jsonError('INTERNAL_ERROR', 'Die Haltestellensuche ist fehlgeschlagen.'), 500);
    }
  });

  app.get('/api/boards', async (c) => {
    try {
      const { diva, limit } = boardsQuerySchema.parse({
        diva: c.req.queries('diva'),
        limit: c.req.query('limit') ?? undefined,
      });

      return c.json(await service.getBoards(diva, limit));
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(jsonError('VALIDATION_ERROR', 'Mindestens eine DIVA-ID wird benötigt.'), 400);
      }

      if (error instanceof UpstreamServiceError) {
        return c.json(jsonError(error.code, error.message), error.status);
      }

      return c.json(jsonError('INTERNAL_ERROR', 'Die Abfahrtsdaten konnten nicht geladen werden.'), 500);
    }
  });

  return app;
};
