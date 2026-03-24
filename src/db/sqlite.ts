import Database from 'better-sqlite3';
import { config } from '../config/index.js';

const db = new Database(config.DB_PATH);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS memory (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export const dbService = {
  saveMessage: (userId: string, role: string, content: string) => {
    const stmt = db.prepare('INSERT INTO messages (userId, role, content) VALUES (?, ?, ?)');
    stmt.run(userId, role, content);
  },

  getHistory: (userId: string, limit: number = 20): Message[] => {
    const stmt = db.prepare('SELECT role, content FROM messages WHERE userId = ? ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(userId, limit) as any[];
    return rows.reverse().map(row => ({
      role: row.role as any,
      content: row.content
    }));
  },

  setMemory: (key: string, value: string) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO memory (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  },

  getMemory: (key: string): string | null => {
    const stmt = db.prepare('SELECT value FROM memory WHERE key = ?');
    const row = stmt.get(key) as any;
    return row ? row.value : null;
  }
};
