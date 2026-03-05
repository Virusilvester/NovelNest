import * as SQLite from "expo-sqlite";
import { Category, HistoryEntry, Novel } from "../types";

type Db = any;

const DB_NAME = "novelnest.db";

let dbPromise: Promise<Db> | null = null;
let initPromise: Promise<void> | null = null;

type BackupPayloadV1 = {
  version: 1;
  exportedAt: string;
  library: {
    categories: Category[];
    novels: Novel[];
  };
  history: HistoryEntry[];
};

function toISOStringOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function reviveDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function serializeNovel(novel: Novel): Novel {
  return {
    ...novel,
    lastReadDate: toISOStringOrNull(novel.lastReadDate) as any,
  } as any;
}

function deserializeNovel(raw: any): Novel {
  return {
    ...raw,
    lastReadDate: reviveDate(raw.lastReadDate),
  } as Novel;
}

function serializeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    ...entry,
    novel: serializeNovel(entry.novel),
    lastReadChapter: {
      ...entry.lastReadChapter,
      releaseDate: toISOStringOrNull(entry.lastReadChapter.releaseDate) as any,
    } as any,
    lastReadDate: toISOStringOrNull(entry.lastReadDate) as any,
  } as any;
}

function deserializeHistoryEntry(raw: any): HistoryEntry {
  return {
    ...raw,
    novel: deserializeNovel(raw.novel),
    lastReadChapter: {
      ...raw.lastReadChapter,
      releaseDate: reviveDate(raw.lastReadChapter?.releaseDate) || new Date(),
    },
    lastReadDate: reviveDate(raw.lastReadDate) || new Date(),
  } as HistoryEntry;
}

async function openDb(): Promise<Db> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const sqliteAny = SQLite as any;
    if (typeof sqliteAny.openDatabaseAsync === "function") {
      return sqliteAny.openDatabaseAsync(DB_NAME);
    }
    return sqliteAny.openDatabase(DB_NAME);
  })();

  return dbPromise;
}

async function getTableColumnNames(db: Db, tableName: string): Promise<string[]> {
  const rows = await getAll<{ name: string }>(db, `PRAGMA table_info(${tableName})`);
  return rows.map((r) => r.name);
}

function quoteIdentifier(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function ensureCategoriesOrderingColumn(db: Db): Promise<void> {
  const names = await getTableColumnNames(db, "categories");
  if (names.includes("ordering")) return;

  // Older schema might have used "order" (reserved keyword) or other naming.
  const sourceColumn =
    (names.includes("order") && quoteIdentifier("order")) ||
    (names.includes("position") && "position") ||
    (names.includes("sort") && "sort") ||
    (names.includes("index") && quoteIdentifier("index")) ||
    null;

  await run(db, "ALTER TABLE categories ADD COLUMN ordering INTEGER");

  if (sourceColumn) {
    await run(db, `UPDATE categories SET ordering = ${sourceColumn} WHERE ordering IS NULL`);
  } else {
    // Best-effort fallback: preserve stable ordering using insertion order.
    await run(db, "UPDATE categories SET ordering = COALESCE(ordering, rowid)");
  }

  await run(db, "UPDATE categories SET ordering = 0 WHERE ordering IS NULL");
}

async function ensureJsonDataColumn(
  db: Db,
  tableName: "novels" | "history_entries",
): Promise<void> {
  const names = await getTableColumnNames(db, tableName);
  if (names.includes("data")) return;

  await run(db, `ALTER TABLE ${tableName} ADD COLUMN data TEXT`);

  const candidate = ["json", "payload", "value", "content", "blob", "data_json"].find((c) =>
    names.includes(c),
  );
  if (candidate) {
    await run(
      db,
      `UPDATE ${tableName} SET data = ${quoteIdentifier(candidate)} WHERE data IS NULL`,
    );
  } else {
    // Best-effort: capture whatever columns exist into JSON so we don't lose data.
    const rows = await getAll<any>(db, `SELECT * FROM ${tableName}`);
    for (const row of rows) {
      const id = row?.id;
      if (id == null) continue;
      const { data: _data, ...rest } = row || {};
      const json = JSON.stringify(rest);
      await run(db, `UPDATE ${tableName} SET data = ? WHERE id = ? AND data IS NULL`, [
        json,
        String(id),
      ]);
    }
  }

  await run(
    db,
    `UPDATE ${tableName} SET data = ? WHERE data IS NULL`,
    [JSON.stringify({ migratedAt: new Date().toISOString() })],
  );
}

async function ensureCanonicalJsonTable(
  db: Db,
  tableName: "novels" | "history_entries",
): Promise<void> {
  const names = await getTableColumnNames(db, tableName);
  if (names.length === 0) return;

  const normalized = names.map((n) => String(n).toLowerCase());
  if (!normalized.includes("id") || !normalized.includes("data")) return;

  const extras = normalized.filter((n) => n !== "id" && n !== "data");
  if (extras.length === 0) return;

  const source = quoteIdentifier(tableName);
  const tmpName = `${tableName}__json_tmp`;
  const tmp = quoteIdentifier(tmpName);
  const fallback = JSON.stringify({
    migratedAt: new Date().toISOString(),
    table: tableName,
  });

  // Merge any legacy columns into the JSON blob so we don't lose data when
  // rebuilding the table to the canonical `{ id, data }` schema.
  const existingRows = await getAll<any>(db, `SELECT * FROM ${source}`);
  for (const row of existingRows) {
    const id = row?.id;
    if (id == null) continue;
    const { data, ...rest } = row || {};

    let base: any = {};
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          base = parsed;
        }
      } catch {
        // ignore parse errors, fall back to legacy columns
      }
    }

    const merged: Record<string, any> = { ...base };
    for (const key of Object.keys(rest)) {
      const value = (rest as any)[key];
      if (value == null && key in merged) continue;
      merged[key] = value;
    }

    const json = JSON.stringify(merged);
    if (json !== data) {
      await run(db, `UPDATE ${source} SET data = ? WHERE id = ?`, [
        json,
        String(id),
      ]);
    }
  }

  await run(db, `DROP TABLE IF EXISTS ${tmp}`);
  await run(
    db,
    `CREATE TABLE ${tmp} (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL
    )`,
  );
  await run(
    db,
    `INSERT OR REPLACE INTO ${tmp} (id, data)
     SELECT id, COALESCE(data, ?) FROM ${source}`,
    [fallback],
  );
  await run(db, `DROP TABLE ${source}`);
  await run(db, `ALTER TABLE ${tmp} RENAME TO ${quoteIdentifier(tableName)}`);
}

async function run(db: Db, sql: string, params: any[] = []): Promise<void> {
  if (typeof db.runAsync === "function") {
    await db.runAsync(sql, params);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          sql,
          params,
          () => resolve(),
          (_: any, err: any) => {
            reject(err);
            return false;
          },
        );
      },
      (err: any) => reject(err),
    );
  });
}

async function getAll<T = any>(
  db: Db,
  sql: string,
  params: any[] = [],
): Promise<T[]> {
  if (typeof db.getAllAsync === "function") {
    return (await db.getAllAsync(sql, params)) as T[];
  }
  return await new Promise<T[]>((resolve, reject) => {
    db.readTransaction(
      (tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, result: any) => resolve(result?.rows?._array || []),
          (_: any, err: any) => {
            reject(err);
            return false;
          },
        );
      },
      (err: any) => reject(err),
    );
  });
}

async function withTransaction(db: Db, fn: (tx: any) => void): Promise<void> {
  if (typeof db.withTransactionAsync === "function") {
    await db.withTransactionAsync(async () => fn(db));
    return;
  }
  if (typeof db.transaction === "function") {
    await new Promise<void>((resolve, reject) => {
      db.transaction(
        (tx: any) => {
          fn(tx);
        },
        (err: any) => reject(err),
        () => resolve(),
      );
    });
    return;
  }

  // Fallback: no explicit transaction API available.
  await Promise.resolve(fn(db));
}

function txRun(txOrDb: any, sql: string, params: any[] = []) {
  if (typeof txOrDb.runAsync === "function") {
    return txOrDb.runAsync(sql, params);
  }
  return txOrDb.executeSql(sql, params);
}

export const DatabaseService = {
  async initialize(): Promise<void> {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const db = await openDb();

      // Avoid multi-statement SQL strings here to support older SQLite driver APIs.
      await run(db, "PRAGMA foreign_keys = ON");
      await run(
        db,
        `CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        )`,
      );
      await run(
        db,
        `CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          ordering INTEGER NOT NULL
        )`,
      );
      await run(
        db,
        `CREATE TABLE IF NOT EXISTS novels (
          id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL
        )`,
      );
      await run(
        db,
        `CREATE TABLE IF NOT EXISTS history_entries (
          id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL
        )`,
      );

      // Migrations for older dev schemas.
      await ensureCategoriesOrderingColumn(db);
      await ensureJsonDataColumn(db, "novels");
      await ensureJsonDataColumn(db, "history_entries");
      await ensureCanonicalJsonTable(db, "novels");
      await ensureCanonicalJsonTable(db, "history_entries");
    })();

    try {
      await initPromise;
    } catch (e) {
      initPromise = null;
      throw e;
    }
  },

  async getLibrary(): Promise<{ categories: Category[]; novels: Novel[] }> {
    const db = await openDb();
    await this.initialize();

    const categories = await getAll<Category>(
      db,
      "SELECT id, name, ordering as `order` FROM categories ORDER BY ordering ASC",
    );
    const novelRows = await getAll<{ id: string; data: string }>(
      db,
      "SELECT id, data FROM novels",
    );
    const novels = novelRows
      .map((r) => {
        if (!r?.data) return null;
        try {
          return deserializeNovel(JSON.parse(r.data));
        } catch {
          return null;
        }
      })
      .filter((n): n is Novel => n != null)
      .sort((a, b) => parseInt(b.id) - parseInt(a.id));

    return { categories, novels };
  },

  async getHistory(): Promise<HistoryEntry[]> {
    const db = await openDb();
    await this.initialize();

    const rows = await getAll<{ id: string; data: string }>(
      db,
      "SELECT id, data FROM history_entries",
    );
    return rows
      .map((r) => {
        if (!r?.data) return null;
        try {
          return deserializeHistoryEntry(JSON.parse(r.data));
        } catch {
          return null;
        }
      })
      .filter((h): h is HistoryEntry => h != null)
      .sort((a, b) => parseInt(b.id) - parseInt(a.id));
  },

  async seedIfEmpty(seed: {
    categories: Category[];
    novels: Novel[];
    history: HistoryEntry[];
  }): Promise<void> {
    const db = await openDb();
    await this.initialize();

    const existing = await getAll<{ count: number }>(
      db,
      "SELECT COUNT(1) as count FROM categories",
    );
    if ((existing?.[0]?.count || 0) > 0) return;

    await this.replaceAll({
      categories: seed.categories,
      novels: seed.novels,
      history: seed.history,
    });
  },

  async upsertNovel(novel: Novel): Promise<void> {
    const db = await openDb();
    await this.initialize();
    const payload = JSON.stringify(serializeNovel(novel));
    await run(
      db,
      "INSERT OR REPLACE INTO novels (id, data) VALUES (?, ?)",
      [novel.id, payload],
    );
  },

  async deleteNovel(novelId: string): Promise<void> {
    const db = await openDb();
    await this.initialize();
    await run(db, "DELETE FROM novels WHERE id = ?", [novelId]);
  },

  async upsertCategory(category: Category): Promise<void> {
    const db = await openDb();
    await this.initialize();
    await run(
      db,
      "INSERT OR REPLACE INTO categories (id, name, ordering) VALUES (?, ?, ?)",
      [category.id, category.name, category.order],
    );
  },

  async deleteCategory(categoryId: string): Promise<void> {
    const db = await openDb();
    await this.initialize();
    await run(db, "DELETE FROM categories WHERE id = ?", [categoryId]);
  },

  async reorderCategories(orderedIds: string[]): Promise<void> {
    const db = await openDb();
    await this.initialize();
    await withTransaction(db, (tx) => {
      orderedIds.forEach((id, index) => {
        txRun(tx, "UPDATE categories SET ordering = ? WHERE id = ?", [
          index,
          id,
        ]);
      });
    });
  },

  async upsertHistoryEntry(entry: HistoryEntry): Promise<void> {
    const db = await openDb();
    await this.initialize();
    const payload = JSON.stringify(serializeHistoryEntry(entry));
    await run(
      db,
      "INSERT OR REPLACE INTO history_entries (id, data) VALUES (?, ?)",
      [entry.id, payload],
    );
  },

  async deleteHistoryEntry(entryId: string): Promise<void> {
    const db = await openDb();
    await this.initialize();
    await run(db, "DELETE FROM history_entries WHERE id = ?", [entryId]);
  },

  async clearHistory(): Promise<void> {
    const db = await openDb();
    await this.initialize();
    await run(db, "DELETE FROM history_entries");
  },

  async replaceAll(payload: {
    categories: Category[];
    novels: Novel[];
    history: HistoryEntry[];
  }): Promise<void> {
    const db = await openDb();
    await this.initialize();

    await withTransaction(db, (tx) => {
      txRun(tx, "DELETE FROM categories");
      txRun(tx, "DELETE FROM novels");
      txRun(tx, "DELETE FROM history_entries");

      payload.categories.forEach((c) => {
        txRun(tx, "INSERT INTO categories (id, name, ordering) VALUES (?, ?, ?)", [
          c.id,
          c.name,
          c.order,
        ]);
      });

      payload.novels.forEach((n) => {
        txRun(tx, "INSERT INTO novels (id, data) VALUES (?, ?)", [
          n.id,
          JSON.stringify(serializeNovel(n)),
        ]);
      });

      payload.history.forEach((h) => {
        txRun(tx, "INSERT INTO history_entries (id, data) VALUES (?, ?)", [
          h.id,
          JSON.stringify(serializeHistoryEntry(h)),
        ]);
      });
    });
  },

  async exportBackup(): Promise<BackupPayloadV1> {
    const { categories, novels } = await this.getLibrary();
    const history = await this.getHistory();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      library: { categories, novels },
      history,
    };
  },

  async importBackup(
    input: unknown,
    options: { mode: "replace" | "merge" } = { mode: "replace" },
  ): Promise<void> {
    if (!input || typeof input !== "object") {
      throw new Error("Invalid backup file.");
    }

    const payload = input as Partial<BackupPayloadV1>;
    if (payload.version !== 1 || !payload.library) {
      throw new Error("Unsupported backup version.");
    }

    const categories = (payload.library.categories || []).map((c) => c);
    const novels = (payload.library.novels || []).map((n: any) =>
      deserializeNovel(n),
    );
    const history = (payload.history || []).map((h: any) =>
      deserializeHistoryEntry(h),
    );

    if (options.mode === "replace") {
      await this.replaceAll({ categories, novels, history });
      return;
    }

    await Promise.all(categories.map((c) => this.upsertCategory(c)));
    await Promise.all(novels.map((n) => this.upsertNovel(n)));
    await Promise.all(history.map((h) => this.upsertHistoryEntry(h)));
  },
};
