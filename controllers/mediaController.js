// controllers/mediaController.js
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import Media from "../models/Media.js";
import DeviceMedia from "../models/DeviceMedia.js";
import { broadcast } from "../wsServer.js";

/* ---------------- multer (memory) ---------------- */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB (adjust)
  },
});

export const uploadMiddleware = upload.single("file");

/* ---------------- cloudinary helper ---------------- */

const uploadToCloudinaryVideo = (buffer, opts = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: process.env.CLOUDINARY_FOLDER || "pg-cms/videos",
        overwrite: true,
        ...opts,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

/* ---------------- controllers ---------------- */

// GET /api/media
export const listMedia = async (req, res) => {
  try {
    const rows = await Media.find({}).sort({ createdAt: -1 }).lean();

    // your frontend accepts either array or { media: [...] }
    return res.json(rows);
    // or: return res.json({ media: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// PATCH /api/media/:mediaId/active
export const setMediaActive = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { active } = req.body;

    const row = await Media.findByIdAndUpdate(
      mediaId,
      { active: !!active },
      { new: true, runValidators: true }
    ).lean();

    if (!row) return res.status(404).json({ error: "Media not found" });

    broadcast({
      type: "MEDIA_UPDATED",
      action: "active",
      mediaId: String(mediaId),
      active: row.active,
    });

    return res.json({ message: "Success", media: row });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// POST /api/media/upload
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const f = req.file;

    // accept mp4 only (match your frontend)
    if (f.mimetype !== "video/mp4") {
      return res.status(400).json({ error: "Only MP4 videos are allowed" });
    }

    // upload buffer to Cloudinary
    const result = await uploadToCloudinaryVideo(f.buffer, {
      // public_id: undefined -> auto
    });

    // save to DB
    const doc = await Media.create({
      originalName: f.originalname,
      filename: f.originalname,
      mimeType: f.mimetype,
      size: f.size,

      // IMPORTANT: store Cloudinary URL (no need to prefix domain in frontend)
      url: result.secure_url,
      cloudinarySecureUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,

      // if your schema has active:
      active: true,
    });

    broadcast({
      type: "MEDIA_UPDATED",
      action: "upload",
      mediaId: String(doc._id),
    });

    return res.json({ message: "Uploaded", media: doc });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// DELETE /api/media/:id   OR   DELETE /api/media/:mediaId
export const deleteMedia = async (req, res) => {
  try {
    // support both param names to prevent route mismatch bugs
    const mediaId = req.params.mediaId || req.params.id;
    if (!mediaId) return res.status(400).json({ error: "mediaId is required" });

    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ error: "Media not found" });

    // 1) delete all assignments first
    await DeviceMedia.deleteMany({ mediaId });

    // 2) delete from cloudinary (if stored there)
    if (media.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(media.cloudinaryPublicId, {
        resource_type: "video",
        invalidate: true,
      });
    }

    // 3) delete DB record
    await Media.deleteOne({ _id: mediaId });

    broadcast({
      type: "MEDIA_UPDATED",
      action: "delete",
      mediaId: String(mediaId),
    });

    return res.json({ message: "Deleted (DB + Cloudinary)" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
