import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getLocalDatabase() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'database', 'odubo.db');
    db = new Database(dbPath);
  }
  return db;
}

export async function queryLocalDatabase<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const database = getLocalDatabase();
  try {
    const stmt = database.prepare(sql);
    const result = stmt.all(...params);
    return result as T[];
  } catch (error) {
    console.error('Local database query error:', error);
    throw error;
  }
}

export async function executeLocalQuery(sql: string, params: any[] = []) {
  const database = getLocalDatabase();
  try {
    const stmt = database.prepare(sql);
    return stmt.run(...params);
  } catch (error) {
    console.error('Local database execute error:', error);
    throw error;
  }
}
