interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: {
    last_row_id?: number;
    [key: string]: unknown;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    [key: string]: unknown;
  };
}
