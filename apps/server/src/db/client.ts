import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// SQLite — 단일 파일, e2-micro에 충분. 동시 1프로세스 전제 (스케일아웃 시 Litestream/PG 검토).
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db: DatabaseType = new Database(path.join(DATA_DIR, 'carphone.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function newId(): string {
  return randomUUID();
}

export function migrate(): void {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_lower TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    google_sub TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (username_lower);

  CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (sender_id, receiver_id),
    CHECK (sender_id <> receiver_id)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, friend_id),
    CHECK (user_id <> friend_id)
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    caller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    callee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ended' CHECK (status IN ('requested','accepted','rejected','ended','failed','missed')),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_sec INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS calls_participants_idx ON calls (caller_id, callee_id);
  `);
  // 구 PG 스키마에서 넘어온 DB 대비 (google_sub이 없을 수 있음)
  const cols = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === 'google_sub')) {
    db.exec(`ALTER TABLE users ADD COLUMN google_sub TEXT UNIQUE`);
  }
}
