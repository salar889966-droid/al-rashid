import express from "express";
import pg from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;
const cloudinaryReady = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (cloudinaryReady) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only image and video files are supported."));
  },
});

app.use(express.json({ limit: "1mb" }));
let databaseReady = false;

async function initializeDatabase() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id BIGSERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size BIGINT NOT NULL DEFAULT 1 CHECK (file_size > 0),
      storage_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE media_assets
      ADD COLUMN IF NOT EXISTS asset_id TEXT,
      ADD COLUMN IF NOT EXISTS public_id TEXT,
      ADD COLUMN IF NOT EXISTS secure_url TEXT,
      ADD COLUMN IF NOT EXISTS resource_type TEXT
  `);
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS media_assets_asset_id_idx ON media_assets(asset_id) WHERE asset_id IS NOT NULL");
  databaseReady = true;
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "al-rashid-marketing-studio-api",
    database: databaseReady ? "connected" : pool ? "connecting" : "not_configured",
    cloudinary: cloudinaryReady ? "configured" : "not_configured",
  });
});

app.get("/api/media", async (_req, res) => {
  if (!cloudinaryReady) return res.status(503).json({ error: "Cloudinary is not configured." });
  try {
    const [images, videos] = await Promise.all([
      cloudinary.api.resources({ resource_type: "image", type: "upload", max_results: 100 }),
      cloudinary.api.resources({ resource_type: "video", type: "upload", max_results: 100 }),
    ]);
    const assets = [...(images.resources || []), ...(videos.resources || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (databaseReady && assets.length) {
      for (const asset of assets) {
        await pool.query(
          `INSERT INTO media_assets
            (file_name, media_type, mime_type, file_size, storage_key, asset_id, public_id, secure_url, resource_type, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (asset_id) WHERE asset_id IS NOT NULL DO UPDATE SET
             file_name=EXCLUDED.file_name, file_size=EXCLUDED.file_size, public_id=EXCLUDED.public_id,
             secure_url=EXCLUDED.secure_url, created_at=EXCLUDED.created_at`,
          [
            asset.display_name || asset.public_id.split("/").pop(),
            asset.resource_type,
            asset.resource_type === "video" ? `video/${asset.format}` : `image/${asset.format}`,
            asset.bytes || 1,
            asset.public_id,
            asset.asset_id,
            asset.public_id,
            asset.secure_url,
            asset.resource_type,
            asset.created_at,
          ]
        );
      }
    }
    res.json({
      items: assets.map((asset) => ({
        id: asset.asset_id,
        name: asset.display_name || asset.public_id.split("/").pop(),
        type: asset.resource_type,
        size: asset.bytes,
        format: asset.format,
        url: asset.secure_url,
        publicId: asset.public_id,
        folder: asset.asset_folder || "",
        createdAt: asset.created_at,
      })),
      total: assets.length,
      syncedToDatabase: databaseReady,
    });
  } catch (error) {
    console.error("Cloudinary media listing failed:", error);
    res.status(502).json({ error: "Could not retrieve media from Cloudinary." });
  }
});

app.post("/api/media/upload", upload.single("file"), async (req, res) => {
  if (!cloudinaryReady) return res.status(503).json({ error: "Cloudinary is not configured." });
  if (!req.file) return res.status(400).json({ error: "Choose an image or video to upload." });
  try {
    const resourceType = req.file.mimetype.startsWith("video/") ? "video" : "image";
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder: "al-rashid-marketing", use_filename: true, unique_filename: true },
        (error, uploaded) => error ? reject(error) : resolve(uploaded)
      );
      stream.end(req.file.buffer);
    });
    if (databaseReady) {
      await pool.query(
        `INSERT INTO media_assets
          (file_name, media_type, mime_type, file_size, storage_key, asset_id, public_id, secure_url, resource_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (asset_id) WHERE asset_id IS NOT NULL DO NOTHING`,
        [req.file.originalname, resourceType, req.file.mimetype, req.file.size, result.public_id, result.asset_id, result.public_id, result.secure_url, resourceType]
      );
    }
    res.status(201).json({ item: {
      id: result.asset_id, name: req.file.originalname, type: resourceType,
      size: result.bytes, format: result.format, url: result.secure_url,
      publicId: result.public_id, createdAt: result.created_at,
    }});
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    res.status(502).json({ error: "Upload failed. Check Cloudinary configuration and try again." });
  }
});

app.delete("/api/media/:assetId", async (req, res) => {
  if (!cloudinaryReady) return res.status(503).json({ error: "Cloudinary is not configured." });
  const { publicId, resourceType = "image" } = req.body || {};
  if (!publicId || !["image", "video"].includes(resourceType)) {
    return res.status(400).json({ error: "Asset public ID and resource type are required." });
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
    if (databaseReady) await pool.query("DELETE FROM media_assets WHERE asset_id = $1", [req.params.assetId]);
    res.json({ result: result.result });
  } catch (error) {
    console.error("Cloudinary deletion failed:", error);
    res.status(502).json({ error: "Could not delete this Cloudinary asset." });
  }
});

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Al Rashid Studio listening on port ${PORT}`);
      console.log(`Database: ${databaseReady ? "connected" : "not configured"}`);
      console.log(`Cloudinary: ${cloudinaryReady ? "configured" : "not configured"}`);
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}

start();
