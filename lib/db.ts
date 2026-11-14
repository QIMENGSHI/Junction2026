import path from "node:path";
import { DuckDBInstance, INTEGER, LIST, listValue } from "@duckdb/node-api";

const DB_PATH = path.join(process.cwd(), "db", "kori.duckdb");

// One read-only instance per server process, kept across Next.js hot reloads in development.
const cache = globalThis as typeof globalThis & { koriDb?: Promise<DuckDBInstance> };

function instance(): Promise<DuckDBInstance> {
  cache.koriDb ??= DuckDBInstance.create(DB_PATH, { access_mode: "READ_ONLY" });
  return cache.koriDb;
}

/** A value bound into a query. Lists are transaction ids. */
export type SqlParam = string | number | boolean | null | number[];

/** Runs one fixed SQL statement with bound values (never pasted into the SQL) and returns
 *  plain JS rows. Each call gets its own connection, so parallel tool calls don't collide. */
export async function query<T>(sql: string, params: Record<string, SqlParam> = {}): Promise<T[]> {
  const values: Record<string, Parameters<typeof listValue>[0][number] | ReturnType<typeof listValue>> = {};
  const types: Record<string, ReturnType<typeof LIST>> = {};
  for (const [name, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      values[name] = listValue(value); // DuckDB can't infer a list's type; name it
      types[name] = LIST(INTEGER);
    } else {
      values[name] = value;
    }
  }
  const connection = await (await instance()).connect();
  try {
    const reader = await connection.runAndReadAll(sql, values, types);
    return reader.getRowObjectsJS() as T[];
  } finally {
    connection.closeSync();
  }
}
