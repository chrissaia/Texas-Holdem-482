# RIVR frontend

React + TypeScript + Vite. See the [root setup guide](../README.md) for Docker and native workflows, API proxy configuration, and team conventions.

```bash
npm ci
npm run dev
npm run build
npm run lint
npm test
npm run test:coverage
```

S13 public-table creation is implemented at `/tables/create`, with persisted table details at `/tables/:id`. S10 public browsing is available at `/lobby`, with search, filters, sorting, pagination, and recovery states; see the [lobby guide](../docs/team/chris/s10-browse-public-tables.md). Vitest, jsdom, and Testing Library cover creation, validation, session and API errors, and recovery. See the [S13 guide](../docs/team/chris/s13-make-a-public-table.md).
