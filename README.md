# Wien Oeffis

Monorepo mit:

- `apps/web`: React + Vite Dashboard
- `apps/api`: Hono Backend für Wiener-Linien-OGD
- `packages/shared`: gemeinsame Typen und Zod-Schemas

## Entwicklung

```bash
npm install
npm run dev
```

Das Web läuft standardmäßig auf `http://localhost:5173`, die API auf `http://localhost:3000`.

## Verifikation

```bash
npm run build
npm run typecheck
npm run test
```
