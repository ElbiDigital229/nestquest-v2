/**
 * File Upload Route
 *
 * Strategy:
 *   - When S3_BUCKET is configured → upload to S3, return public CDN URL
 *   - Otherwise → save to local disk (dev / no-S3 fallback), return /uploads/{filename}
 *
 * All uploads are:
 *   - Renamed to a UUID (prevents path traversal, avoids collisions)
 *   - Validated by MIME type (allowlist)
 *   - Capped at MAX_FILE_SIZE
 *
 * S3 files are stored under the `uploads/` prefix. Access control:
 *   - Images: public-read (used in property listings)
 *   - Documents (PDF/DOC): uploaded with private ACL, retrieve via signed URLs
 *     (signed URL generation is handled by the consuming endpoint, not here)
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import rateLimit from "express-rate-limit";
import logger from "../utils/logger";

const router = Router();

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

// Local-disk upload directory. Overridable via UPLOADS_DIR so production can
// mount a persistent volume (e.g. /data/uploads) instead of the ephemeral
// /app/uploads inside the container.
const LOCAL_UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(__dirname2, "../uploads");

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Images can be public; documents should be private
const PRIVATE_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ── S3 client (lazy — only created if S3_BUCKET is set) ──

const s3Enabled = !!process.env.S3_BUCKET;

const s3 = s3Enabled
  ? new S3Client({
      region: process.env.AWS_REGION || "me-central-1",
      // Credentials: IAM role on EC2 (preferred) or explicit env vars
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    })
  : null;

// ── Multer storage: memory buffer (for S3) or disk (for local) ──

const storage = s3Enabled
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: LOCAL_UPLOADS_DIR,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPG, JPEG, WEBP, PDF, and DOC/DOCX files are allowed"));
    }
  },
});

// ── Upload to S3 ───────────────────────────────────────

async function uploadToS3(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `uploads/${crypto.randomUUID()}${ext}`;
  const isPrivate = PRIVATE_MIME_TYPES.has(file.mimetype);

  const uploader = new Upload({
    client: s3!,
    params: {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Public images are accessible directly; private docs require signed URLs
      ACL: isPrivate ? "private" : "public-read",
      // Cache static assets for 1 year; documents for 1 day
      CacheControl: isPrivate ? "max-age=86400" : "max-age=31536000",
    },
  });

  await uploader.done();

  // Return public URL for images; return S3 key for private docs
  // (callers that need a signed URL will call GET /api/upload/signed-url?key=...)
  if (isPrivate) {
    return `s3://${process.env.S3_BUCKET}/${key}`;
  }

  const region = process.env.AWS_REGION || "me-central-1";
  return `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

// ── POST /api/upload/signup — Unauthenticated upload for signup documents ──

const signupUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many uploads. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/signup", signupUploadLimiter, (req: Request, res: Response) => {
  upload.single("file")(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File exceeds the 10MB limit" });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || "File upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      let url: string;
      if (s3Enabled && s3) {
        url = await uploadToS3(req.file);
      } else {
        url = `/uploads/${(req.file as any).filename}`;
      }
      return res.json({ url });
    } catch (uploadErr: any) {
      logger.error({ err: uploadErr }, "Signup upload failed");
      return res.status(500).json({ error: "File upload failed" });
    }
  });
});

// ── POST /api/upload ───────────────────────────────────

router.post("/", (req: Request, res: Response) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  upload.single("file")(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File exceeds the 10MB limit" });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || "File upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      let url: string;

      if (s3Enabled && s3) {
        url = await uploadToS3(req.file);
        logger.info(
          { userId: req.session.userId, key: url, mimetype: req.file.mimetype, size: req.file.size },
          "File uploaded to S3"
        );
      } else {
        // Local disk fallback
        url = `/uploads/${(req.file as any).filename}`;
        logger.info(
          { userId: req.session.userId, url, mimetype: req.file.mimetype },
          "File saved to local disk"
        );
      }

      return res.json({ url });
    } catch (uploadErr: any) {
      logger.error({ err: uploadErr, userId: req.session.userId }, "S3 upload failed");
      return res.status(500).json({ error: "File upload failed" });
    }
  });
});

// ── DELETE /api/upload — Delete a file ────────────────
// Used when a user removes an image or document they previously uploaded.

router.delete("/", async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { url: fileUrl } = req.body;
  if (!fileUrl || typeof fileUrl !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    if (s3Enabled && s3 && (fileUrl.startsWith("https://") || fileUrl.startsWith("s3://"))) {
      // Extract S3 key from URL
      let key: string;
      if (fileUrl.startsWith("s3://")) {
        key = fileUrl.replace(`s3://${process.env.S3_BUCKET}/`, "");
      } else {
        // https://bucket.s3.region.amazonaws.com/key
        const urlObj = new URL(fileUrl);
        key = urlObj.pathname.slice(1); // remove leading /
      }

      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
        })
      );

      logger.info({ userId: req.session.userId, key }, "S3 object deleted");
    }
    // For local files we intentionally do not delete from disk here —
    // the server process should not have write access to itself in production.

    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err, fileUrl }, "File deletion error");
    return res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
