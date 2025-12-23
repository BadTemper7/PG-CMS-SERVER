// controllers/mediaController.js
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import Media from "../models/Media.js";
import DeviceMedia from "../models/DeviceMedia.js";
import { broadcast } from "../wsServer.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB (adjust)
  },
});

export const uploadMiddleware = upload.single("file");

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

// POST /api/media/upload
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const f = req.file;
    if (f.mimetype !== "video/mp4") {
      return res.status(400).json({ error: "Only MP4 videos are allowed" });
    }

    // upload buffer to Cloudinary
    const result = await uploadToCloudinaryVideo(f.buffer, {
      public_id: undefined, // auto
    });

    // save to DB
    const doc = await Media.create({
      originalName: f.originalname,
      filename: f.originalname,
      mimeType: f.mimetype,
      size: f.size,

      // IMPORTANT: store Cloudinary URL
      url: result.secure_url,
      cloudinarySecureUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
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

// DELETE /api/media/:id
export const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ error: "Media not found" });

    // 1) delete all assignments first
    await DeviceMedia.deleteMany({ mediaId });

    // 2) delete from cloudinary (if stored there)
    if (media.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(media.cloudinaryPublicId, {
        resource_type: "video",
        invalidate: true, // clears CDN cached copies
      });
    }

    // 3) delete DB record
    await Media.deleteOne({ _id: mediaId });

    return res.json({ message: "Deleted (DB + Cloudinary)" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
