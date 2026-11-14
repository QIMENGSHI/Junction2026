import path from "node:path";
import { mkdir } from "node:fs/promises";
import { DuckDBInstance, INTEGER, LIST, listValue } from "@duckdb/node-api";

const BUNDLED_PATH = path.join(process.cwd(), "db", "kori.duckdb");
export type DbMode = "motherduck" | "local" | "test";

// One instance per process, kept across hot reloads. Only cloud/test instances can write.
const cache = globalThis as typeof globalThis & { koriDb?: Promise<DuckDBInstance>; koriDbMode?: DbMode };

async function openInstance(): Promise<DuckDBInstance> {
  if (process.env.KORI_DB_PATH) {
    const target = path.resolve(process.env.KORI_DB_PATH);
    const writable = process.env.KORI_DB_WRITABLE === "1";
    if (writable && target === BUNDLED_PATH) throw new Error("Writable test mode must use a separate database copy.");
    cache.koriDbMode = writable ? "test" : "local";
    return DuckDBInstance.create(target, { access_mode: writable ? "READ_WRITE" : "READ_ONLY" });
  }
  if (process.env.MOTHERDUCK_TOKEN) {
    const database = process.env.KORI_MD_DATABASE ?? "kori";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) throw new Error("Invalid KORI_MD_DATABASE.");
    try {
      await mkdir("/tmp/duckdb-ext", { recursive: true });
      const remote = await DuckDBInstance.fromCache(`md:${database}?attach_mode=single`, {
        motherduck_token: process.env.MOTHERDUCK_TOKEN,
        home_directory: "/tmp", extension_directory: "/tmp/duckdb-ext",
      });
      cache.koriDbMode = "motherduck";
      return remote;
    } catch {
      // Do not log connection errors: a driver message could contain credentials.
      console.warn("[kori] MotherDuck initialization failed; using the read-only offline demo.");
    }
  }
  cache.koriDbMode = "local";
  return DuckDBInstance.create(BUNDLED_PATH, { access_mode: "READ_ONLY" });
}

export function instance(): Promise<DuckDBInstance> {
  cache.koriDb ??= openInstance().catch((error) => { cache.koriDb = undefined; throw error; });
  return cache.koriDb;
}

export async function dbMode(): Promise<DbMode> {
  await instance();
  return cache.koriDbMode!;
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
