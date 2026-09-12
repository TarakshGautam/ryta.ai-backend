import { createClient } from "@libsql/client";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";

export const db = createClient({
  url: ENV.TURSO_DATABASE_URL,
  authToken: ENV.TURSO_AUTH_TOKEN,
});

async function addColumnIfMissing(table: string, column: string, definition: string) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    logger.info(`Added column ${table}.${column}`);
  } catch {
    // Column already exists, safe to ignore
  }
}

export const initializeDatabase = async () => {
  try {
    // Enable Foreign Key support in SQLite/Turso
    await db.execute(`PRAGMA foreign_keys = ON;`);

    // Core Tables Setup
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS guest_sessions (
        id TEXT PRIMARY KEY,
        merged_into_user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        merged_at DATETIME
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        guest_session_id TEXT,
        title TEXT NOT NULL,
        mode TEXT DEFAULT 'ryka',
        is_pinned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrations / Safe Alter Statements for Conversations
    await addColumnIfMissing("conversations", "guest_session_id", "TEXT");
    await addColumnIfMissing("conversations", "mode", "TEXT DEFAULT 'ryka'");
    await addColumnIfMissing("conversations", "is_pinned", "INTEGER DEFAULT 0");
    await addColumnIfMissing("conversations", "archived_at", "DATETIME");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);
    await addColumnIfMissing("messages", "image_url", "TEXT");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS diary_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        guest_session_id TEXT,
        title TEXT,
        content TEXT NOT NULL,
        mood TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await addColumnIfMissing("diary_entries", "guest_session_id", "TEXT");
    await addColumnIfMissing("diary_entries", "title", "TEXT");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS memory_vault (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        guest_session_id TEXT,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await addColumnIfMissing("memory_vault", "guest_session_id", "TEXT");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS shared_activities (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        guest_session_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS relationship_experiences (
        id TEXT PRIMARY KEY,
        creator_user_id TEXT,
        creator_guest_id TEXT,
        slug TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        theme TEXT,
        cover_media TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS experience_responses (
        id TEXT PRIMARY KEY,
        experience_id TEXT NOT NULL,
        partner_name TEXT,
        response_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (experience_id) REFERENCES relationship_experiences(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS music_tracks (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_track_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        album_art_url TEXT,
        duration_ms INTEGER,
        preview_url TEXT,
        external_url TEXT NOT NULL,
        is_playable INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        guest_session_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        mood TEXT,
        cover_url TEXT,
        is_public INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        music_track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (music_track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS music_moments (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        guest_session_id TEXT,
        conversation_id TEXT,
        message_id TEXT,
        music_track_id TEXT NOT NULL,
        note TEXT,
        mood TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (music_track_id) REFERENCES music_tracks(id)
      )
    `);

    // Optimized Performance Indexes
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_conversations_guest ON conversations(guest_session_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations(mode)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_diary_user ON diary_entries(user_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_diary_guest ON diary_entries(guest_session_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_vault(user_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_memory_guest ON memory_vault(guest_session_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_experiences_slug ON relationship_experiences(slug)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_music_tracks_provider ON music_tracks(provider, provider_track_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_playlists_guest ON playlists(guest_session_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id)`);

    logger.info("Database tables initialized with full mode support & performance indexes verified successfully.");
  } catch (error) {
    logger.error("Failed to initialize database:", error);
    throw error;
  }
};