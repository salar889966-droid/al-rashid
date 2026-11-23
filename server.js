import express from "express";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

app.use(express.json({ limit: "1mb" }));

let databaseReady = false;
async function initializeDatabase() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id BIGSERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
      mime_type TEXT NOT NULL,
      file_size BIGINT NOT NULL CHECK (file_size > 0),
      storage_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  databaseReady = true;
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "al-rashid-marketing-studio-api",
    database: databaseReady ? "connected" : pool ? "connecting" : "not_configured",
  });
});

app.get("/api/media", async (_req, res) => {
  if (!databaseReady) {
    return res.status(503).json({ error: "Database is not configured yet." });
  }
  try {
    const result = await pool.query(
      "SELECT id, file_name, media_type, mime_type, file_size, storage_key, created_at FROM media_assets ORDER BY created_at DESC LIMIT 100"
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error("Media list failed:", error);
    res.status(500).json({ error: "Could not load media records." });
  }
});

app.post("/api/media", async (req, res) => {
  if (!databaseReady) {
    return res.status(503).json({ error: "Database is not configured yet." });
  }
  const { fileName, mediaType, mimeType, fileSize, storageKey = null } = req.body ?? {};
  if (
    typeof fileName !== "string" || !fileName.trim() || fileName.length > 255 ||
    !["image", "video"].includes(mediaType) ||
    typeof mimeType !== "string" || !/^(image|video)\//.test(mimeType) ||
    !Number.isSafeInteger(fileSize) || fileSize <= 0
  ) {
    return res.status(400).json({ error: "Invalid media metadata." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO media_assets (file_name, media_type, mime_type, file_size, storage_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, file_name, media_type, mime_type, file_size, storage_key, created_at`,
      [fileName.trim(), mediaType, mimeType, fileSize, storageKey]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error("Media record creation failed:", error);
    res.status(500).json({ error: "Could not save media record." });
  }
});

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Al Rashid Studio listening on port ${PORT}`);
      console.log(`Database: ${databaseReady ? "connected" : "not configured"}`);
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}

start();
