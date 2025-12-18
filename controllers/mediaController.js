import crypto from "crypto";
import fs from "fs";
import Media from "../models/Media.js";
import { broadcast } from "../wsServer.js";
import path from "path";
import { fileURLToPath } from "url";
import DeviceMedia from "../models/DeviceMedia.js";

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash("md5").update(fileBuffer).digest("hex");

    const media = await Media.create({
      originalName: req.file.originalname,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      checksum,
      active: true,
    });

    broadcast({ type: "MEDIA_UPDATED", action: "create", media });

    res.status(201).json({ message: "Uploaded", media });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const listMedia = async (req, res) => {
  const media = await Media.find().sort({ createdAt: -1 }).lean();
  res.json(media);
};

export const setMediaActive = async (req, res) => {
  try {
    const { active } = req.body;
    const media = await Media.findByIdAndUpdate(
      req.params.id,
      { active: !!active },
      { new: true, runValidators: true }
    ).lean();

    if (!media) return res.status(404).json({ error: "Media not found" });

    broadcast({ type: "MEDIA_UPDATED", action: "update", media });
    res.json({ message: "Updated", media });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

export const deleteMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    // build file path from stored url or filename
    // url example: /uploads/1766037087501-938624063.mp4
    const fileNameFromUrl = media.url?.split("/").pop();
    const fileName = fileNameFromUrl || media.filename;
    const filePath = fileName ? path.join(UPLOAD_DIR, fileName) : null;

    // 1) remove file from disk
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (err) {
        // don't hard-fail if file is missing; still remove DB record
        console.warn("[DELETE MEDIA] Failed to delete file:", err.message);
      }
    }

    // 2) delete DeviceMedia mappings (recommended)
    await DeviceMedia.deleteMany({ mediaId: media._id });

    // 3) delete media from DB
    await Media.deleteOne({ _id: media._id });

    broadcast({ type: "MEDIA_UPDATED", action: "delete", mediaId: media._id });

    res.json({ message: "Media deleted", mediaId: media._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};