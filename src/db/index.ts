import { createClient } from "@libsql/client";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";

export const db = createClient({
  url: ENV.TURSO_DATABASE_URL,
  authToken: ENV.TURSO_AUTH_TOKEN,
});

export const initializeDatabase = async () => {
  try {
    // Enable foreign keys before running batch migrations
    await db.execute("PRAGMA foreign_keys = ON;");

    // Single batch transaction execution to prevent Vercel Serverless Timeouts
    await db.batch(
      [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS guest_sessions (
          id TEXT PRIMARY KEY,
          merged_into_user_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          merged_at DATETIME,
          FOREIGN KEY (merged_into_user_id) REFERENCES users(id) ON DELETE SET NULL
        );`,

        `CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          guest_session_id TEXT,
          title TEXT NOT NULL,
          mode TEXT DEFAULT 'ryka',
          is_pinned INTEGER DEFAULT 0,
          archived_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          content TEXT NOT NULL,
          image_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS diary_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          guest_session_id TEXT,
          title TEXT,
          content TEXT NOT NULL,
          mood TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS memory_vault (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          guest_session_id TEXT,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS shared_activities (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          guest_session_id TEXT,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS relationship_experiences (
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
        );`,

        `CREATE TABLE IF NOT EXISTS experience_responses (
          id TEXT PRIMARY KEY,
          experience_id TEXT NOT NULL,
          partner_name TEXT,
          response_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (experience_id) REFERENCES relationship_experiences(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS music_tracks (
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
        );`,

        `CREATE TABLE IF NOT EXISTS playlists (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          guest_session_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          mood TEXT,
          cover_url TEXT,
          is_public INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS playlist_tracks (
          id TEXT PRIMARY KEY,
          playlist_id TEXT NOT NULL,
          music_track_id TEXT NOT NULL,
          position INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (music_track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS music_moments (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          guest_session_id TEXT,
          conversation_id TEXT,
          message_id TEXT,
          music_track_id TEXT NOT NULL,
          note TEXT,
          mood TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
          FOREIGN KEY (music_track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
        );`,

        // Security & Performance Indexes
        `CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_guest ON conversations(guest_session_id);`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations(mode);`,
        `CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);`,
        `CREATE INDEX IF NOT EXISTS idx_diary_user ON diary_entries(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_diary_guest ON diary_entries(guest_session_id);`,
        `CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_vault(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_memory_guest ON memory_vault(guest_session_id);`,
        `CREATE INDEX IF NOT EXISTS idx_experiences_slug ON relationship_experiences(slug);`,
        `CREATE INDEX IF NOT EXISTS idx_exp_responses_exp_id ON experience_responses(experience_id);`,
        `CREATE INDEX IF NOT EXISTS idx_music_tracks_provider ON music_tracks(provider, provider_track_id);`,
        `CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_playlists_guest ON playlists(guest_session_id);`,
        `CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);`,
        `CREATE INDEX IF NOT EXISTS idx_music_moments_user ON music_moments(user_id);`
      ],
      "write"
    );

    logger.info("Database initialized successfully via batch execution with enhanced FK constraint security.");
  } catch (error) {
    logger.error("Failed to initialize database:", error);
    throw error;
  }
};