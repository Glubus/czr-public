export class Metrics {
  readonly #requests = new Map<string, number>();
  readonly #rateLimitFallbacks = { value: 0 };

  recordRequest(method: string, path: string, status: number) {
    const key = `${method}|${routeFamily(path)}|${status}`;
    this.#requests.set(key, (this.#requests.get(key) ?? 0) + 1);
  }

  recordRateLimitFallback() {
    this.#rateLimitFallbacks.value += 1;
  }

  renderPrometheus() {
    const lines = [
      "# HELP zwr_http_requests_total Total HTTP requests.",
      "# TYPE zwr_http_requests_total counter",
    ];
    for (const [key, count] of this.#requests) {
      const [method, path, status] = key.split("|");
      lines.push(
        `zwr_http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`,
      );
    }
    lines.push(
      "# HELP zwr_rate_limit_fallback_total Redis rate-limit failures that used local memory.",
      "# TYPE zwr_rate_limit_fallback_total counter",
      `zwr_rate_limit_fallback_total ${this.#rateLimitFallbacks.value}`,
    );
    return `${lines.join("\n")}\n`;
  }
}

function routeFamily(path: string) {
  return path
    .replace(/[0-9]+/g, ":id")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
}
