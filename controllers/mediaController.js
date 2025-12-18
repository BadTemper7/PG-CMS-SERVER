import crypto from "crypto";
import fs from "fs";
import Media from "../models/Media.js";
import { broadcast } from "../wsServer.js";

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Optional checksum (good for cache validation)
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash("md5").update(fileBuffer).digest("hex");

    const media = await Media.create({
      originalName: req.file.originalname,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      checksum,
    });

    broadcast({ type: "MEDIA_UPDATED", action: "create", media });

    res.status(201).json({ message: "Uploaded", media });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const listMedia = async (req, res) => {
  const media = await Media.find().sort({ createdAt: -1 });
  res.json(media);
};
