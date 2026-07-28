# Zombies Records web app

SvelteKit 2 / Svelte 5 frontend written in TypeScript. Pages are server-rendered and access the existing API
through the private `API_BASE_URL` environment variable.

```sh
cp .env.example .env
npm install
npm run dev
```

The development server uses `http://localhost:8888/v1` by default. Docker Compose uses
`http://api:3000/v1` on its internal network and serves the website through Caddy at
`http://localhost:8888`.

## Checks

```sh
npm run check
npm run lint
npm test
npm run build
```
