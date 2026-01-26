import fs from "fs";
import Video from "../models/Video.js";
import {
  uploadVideoFile,
  deleteCloudinaryVideo,
} from "../services/cloudinaryService.js";
import OutletVideoAssignment from "../models/OutletVideoAssignment.js";
import Terminal from "../models/Terminal.js";
import { broadcast, sendToDeviceBoth, sendToDevice } from "../wsServer.js";

export const createVideo = async (req, res) => {
  try {
    const { title, description, active = true } = req.body;

    if (!title) return res.status(400).json({ error: "title is required" });
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const localPath = req.file.path;

    let result;
    try {
      result = await uploadVideoFile(localPath);
    } finally {
      try {
        fs.unlinkSync(localPath);
      } catch {}
    }

    const video = await Video.create({
      title,
      description,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      bytes: result.bytes || 0,
      durationSec: result.duration || 0,
      format: result.format || "",
      active: !!active,
    });

    return res.json(video);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const listVideos = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const rows = await Video.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const getVideo = async (req, res) => {
  try {
    const row = await Video.findById(req.params.videoId).lean();
    if (!row) return res.status(404).json({ error: "Video not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const updateVideo = async (req, res) => {
  try {
    const row = await Video.findByIdAndUpdate(req.params.videoId, req.body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!row) return res.status(404).json({ error: "Video not found" });

    // ✅ Only trigger refresh if relevant fields changed
    const changedKeys = Object.keys(req.body || {});
    const shouldRefreshPlayers = [
      "active",
      "url",
      "cloudinarySecureUrl",
      "durationSec",
      "title",
      "filename",
      "originalName",
    ].some((k) => changedKeys.includes(k));

    if (shouldRefreshPlayers) {
      // ✅ Find all outlets that currently use this video (active assignment)
      const assignments = await OutletVideoAssignment.find({
        videoId: row._id,
        active: true,
      })
        .select("outletId")
        .lean();

      const outletIds = [
        ...new Set(assignments.map((a) => String(a.outletId))),
      ];

      if (outletIds.length) {
        // ✅ Find terminals under those outlets
        const terminals = await Terminal.find({
          outletId: { $in: outletIds },
          active: true,
        })
          .select("_id code deviceKey outletId")
          .lean();

        // ✅ Push to affected terminals
        for (const t of terminals) {
          const payload = {
            type: "OUTLET_PLAYLIST_CHANGED",
            reason: "VIDEO_UPDATED",
            outletId: String(t.outletId),
            videoId: String(row._id),
            changedKeys,
            active: row.active,
          };

          // Best: terminal connects using deviceMongoId
          sendToDevice(String(t._id), payload);

          // If terminal connects using code
          if (t.code) sendToDevice(t.code, payload);

          // If terminal connects using deviceKey (TERM-01-SECRET)
          if (t.deviceKey) sendToDevice(t.deviceKey, payload);
        }
      }

      // ✅ Optional: notify all admin dashboards
      broadcast({
        type: "ADMIN_VIDEO_UPDATED",
        videoId: String(row._id),
        active: row.active,
        changedKeys,
        outletIds,
      });
    }

    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const removeVideo = async (req, res) => {
  try {
    const { deleteCloudinary = "false" } = req.query;

    const row = await Video.findById(req.params.videoId).lean();
    if (!row) return res.status(404).json({ error: "Video not found" });

    await Video.deleteOne({ _id: row._id });

    // optional: also remove from Cloudinary
    if (deleteCloudinary === "true") {
      try {
        await deleteCloudinaryVideo(row.publicId);
      } catch {
        // ignore cloudinary errors, because DB already deleted
      }
    }

    return res.json({ message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
