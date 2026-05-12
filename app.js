import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// API: insert a row into Bafang via query params
// Example: /api/insert?date=2023年&product=招牌鍋貼&unit_price=6.3
app.get('/api/insert', (req, res) => {
	const { date, product, unit_price } = req.query;
	if (!date || !product || typeof unit_price === 'undefined') {
		return res.status(400).json({ error: 'Missing date, product or unit_price query parameter' });
	}

	const db = app.locals.db;
	if (!db) return res.status(500).json({ error: 'Database not initialized' });

	const price = Number(unit_price);
	if (Number.isNaN(price)) return res.status(400).json({ error: 'unit_price must be a number' });

	const sql = 'INSERT INTO "Bafang" ("date","product","unit_price") VALUES (?,?,?)';
	db.run(sql, [date, product, price], function(err) {
		if (err) return res.status(500).json({ error: err.message });
		return res.json({ success: true, lastID: this.lastID });
	});
});

// API: return all rows from movie_quotes
app.get('/api/quotes', (req, res) => {
	const db = app.locals.db;
	if (!db) return res.status(500).json({ error: 'Database not initialized' });

	db.all('SELECT rowid as id, "date", "product", "unit_price" FROM "Bafang"', [], (err, rows) => {
		if (err) {
			return res.status(200).json({ rows: [] });
		}
		res.json({ rows });
	});
});

// Update a row by id (expects JSON body)
app.post('/api/update', (req, res) => {
	const { id, date, product, unit_price } = req.body || {};
	if (!id) return res.status(400).json({ error: 'Missing id' });
	const db = app.locals.db;
	if (!db) return res.status(500).json({ error: 'Database not initialized' });

	const price = Number(unit_price);
	if (Number.isNaN(price)) return res.status(400).json({ error: 'unit_price must be a number' });

	db.run('UPDATE "Bafang" SET "date" = ?, "product" = ?, "unit_price" = ? WHERE rowid = ?', [date, product, price, id], function(err) {
		if (err) return res.status(500).json({ error: err.message });
		return res.json({ success: true, changes: this.changes });
	});
});

// Delete a row by id
app.get('/api/delete', (req, res) => {
	const id = req.query.id;
	if (!id) return res.status(400).json({ error: 'Missing id' });
	const db = app.locals.db;
	if (!db) return res.status(500).json({ error: 'Database not initialized' });

	db.run('DELETE FROM "Bafang" WHERE rowid = ?', [id], function(err) {
		if (err) return res.status(500).json({ error: err.message });
		return res.json({ success: true, changes: this.changes });
	});
});

// Open SQLite DB (do not import db.js here) and attach to app.locals
(async () => {
	try {
		const dbDir = path.join(__dirname, 'db');
		await fs.promises.mkdir(dbDir, { recursive: true });
		const dbFile = path.join(dbDir, 'sqlite.db');

		const sqlite = sqlite3.verbose();
		const db = await new Promise((resolve, reject) => {
			const d = new sqlite.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
				if (err) return reject(err);
				resolve(d);
			});
		});

		app.locals.db = db;
		console.log('SQLite DB opened at', dbFile);

		// Ensure Bafang table exists and seed if empty
		try {
			await new Promise((resolve, reject) => {
				db.run(`CREATE TABLE IF NOT EXISTS "Bafang" ("date" TEXT, "product" TEXT, "unit_price" REAL)`, (err) => {
					if (err) return reject(err);
					resolve();
				});
			});
		} catch (e) {
			console.error('Error ensuring/seeding Bafang table:', e.message || e);
		}

		process.on('exit', () => {
			try { db.close(); } catch (e) {}
		});
	} catch (e) {
		console.error('Failed to open SQLite DB in app.js:', e.message || e);
	}
})();

export default app;
