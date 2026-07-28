import { closeDatabase, createDatabase } from "../src/db/client.ts";
import { createApp } from "../src/http/app.ts";
import { createRedisStore } from "../src/infra/redis.ts";

const database = createDatabase();
const redisUrl = Deno.env.get("REDIS_URL");
const redis = redisUrl ? await createRedisStore(redisUrl) : undefined;
const app = createApp({ db: database, redis });
const concurrency = positiveInteger(Deno.env.get("BENCHMARK_CONCURRENCY") ?? "20");
const nonce = crypto.randomUUID();
const routes = [
  "/v1/leaderboard?page=0",
  "/v1/maps?page=0",
  "/v1/users?page=0",
  "/v1/teams/leaderboard?player_count=2&page=0",
  "/v1/clans/leaderboard?page=0",
];

try {
  const cold = await benchmark(routes.map((route) => withNonce(route, `${nonce}-cold`)));
  const warmRoutes = routes.map((route) => withNonce(route, `${nonce}-warm`));
  await benchmark(warmRoutes);
  const warm = await benchmark(warmRoutes);
  const concurrent = await benchmark(
    Array.from({ length: concurrency }, () => routes).flat().map((route) =>
      withNonce(route, `${nonce}-concurrent`)
    ),
  );
  console.log(JSON.stringify(
    {
      event: "api_benchmark",
      concurrency,
      routes,
      cold: summarize(cold),
      warm: summarize(warm),
      concurrent: summarize(concurrent),
    },
    null,
    2,
  ));
} finally {
  await redis?.close();
  await closeDatabase(database);
}

async function benchmark(paths: string[]) {
  const startedAt = performance.now();
  const results = await Promise.all(paths.map(async (path) => {
    const requestStartedAt = performance.now();
    const response = await app.request(path);
    await response.arrayBuffer();
    return { path, status: response.status, durationMs: performance.now() - requestStartedAt };
  }));
  return { wallMs: performance.now() - startedAt, results };
}

function summarize(run: Awaited<ReturnType<typeof benchmark>>) {
  const durations = run.results.map((result) => result.durationMs).sort((left, right) => left - right);
  const statuses = Object.fromEntries(
    Map.groupBy(run.results, (result) => result.status).entries().map((
      [status, results],
    ) => [status, results.length]),
  );
  return {
    requests: durations.length,
    wallMs: round(run.wallMs),
    p50Ms: round(percentile(durations, 0.5)),
    p95Ms: round(percentile(durations, 0.95)),
    maxMs: round(durations.at(-1) ?? 0),
    statuses,
  };
}

function percentile(values: number[], ratio: number) {
  return values[Math.min(values.length - 1, Math.floor(values.length * ratio))] ?? 0;
}

function withNonce(path: string, nonce: string) {
  return `${path}${path.includes("?") ? "&" : "?"}_benchmark=${nonce}`;
}

function positiveInteger(value: string) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("BENCHMARK_CONCURRENCY must be a positive integer");
  return Number(value);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
