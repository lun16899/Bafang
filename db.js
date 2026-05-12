import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, 'db');
const dbFile = join(dbDir, 'sqlite.db');

async function ensureDbDir() {
  await fs.promises.mkdir(dbDir, { recursive: true });
}

export async function openDatabase() {
  await ensureDbDir();

  return new Promise((resolve, reject) => {
    const sqlite = sqlite3.verbose();
    const db = new sqlite.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // quick verification query
      db.get('SELECT 1 as ok', (qerr, row) => {
        if (qerr) {
          reject(qerr);
        } else {
          resolve(db);
        }
      });
    });
  });
}

export default openDatabase;

/**
 * Ensure the table `Bafang` exists with columns: date, product, unit_price
 * date: TEXT, product: TEXT, unit_price: REAL
 */
export function ensureTableExists(db) {
  const createSql = `CREATE TABLE IF NOT EXISTS "Bafang" (
    "date" TEXT,
    "product" TEXT,
    "unit_price" REAL
  )`;

  return new Promise((resolve, reject) => {
    db.run(createSql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Open DB and ensure table exists. Returns the opened db instance.
 */
export async function initDatabase() {
  const db = await openDatabase();
  await ensureTableExists(db);
  return db;
}

/**
 * Seed the `Bafang` table with predefined rows.
 * Expects an opened `db` instance.
 */
export function seedBafangData(db) {
  // base years and products/prices; we'll append a random month to each year (format YYYY-MM)
  const base = [
    ['2010-02','招牌鍋貼',4],
    ['2013-06','招牌鍋貼',4.5],
    ['2016-09','招牌鍋貼',5],
    ['2018-01','招牌鍋貼',5],
    ['2018-03','韭菜鍋貼',5],
    ['2018-05','韓式辣味鍋貼',5],
    ['2019-01','咖哩鍋貼',5.5],
    ['2019-02','玉米鍋貼',5.5],
    ['2021-01','招牌鍋貼',6],
    ['2021-02','韓式辣味鍋貼',6],
    ['2023-09','招牌鍋貼',6.3],
    ['2023-11','韭菜鍋貼',6.3],
    ['2023-11','咖哩鍋貼',6.3],
    ['2025-01','招牌鍋貼',7]
  ];

  // base already contains full YYYY-MM date strings, use directly
  const rows = base.map(([date, product, price]) => [date, product, price]);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare('INSERT INTO "Bafang" ("date","product","unit_price") VALUES (?,?,?)');
      for (const r of rows) {
        stmt.run(r, (err) => {
          if (err) {
            // log and continue; we'll reject on finalize if needed
            console.error('Insert error for', r, err.message || err);
          }
        });
      }
      stmt.finalize((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

// If run directly, try to open and report status
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      const db = await initDatabase();
      console.log('SQLite DB opened and table ensured at', dbFile);
      await seedBafangData(db);
      console.log('Seeded Bafang table with sample data.');
      db.close();
    } catch (e) {
      console.error('Failed to open/initialize/seed SQLite DB:', e.message || e);
      process.exit(1);
    }
  })();
}
