FROM denoland/deno:2.9.2

WORKDIR /app

COPY deno.json deno.lock ./
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src

RUN deno cache src/index.ts src/worker.ts

RUN mkdir -p /var/lib/zwr/client-blobs && chown -R deno:deno /var/lib/zwr

USER deno
EXPOSE 3000

CMD ["task", "start"]
