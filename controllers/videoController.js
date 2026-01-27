import fs from "fs";
import Video from "../models/Video.js";
import {
  uploadVideoFile,
  deleteCloudinaryVideo,
} from "../services/cloudinaryService.js";
import OutletVideoAssignment from "../models/OutletVideoAssignment.js";
import Outlet from "../models/Outlet.js";
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

    // Delete video from the Video collection
    await Video.deleteOne({ _id: row._id });

    // Delete related outlet assignments from OutletVideoAssignment
    await OutletVideoAssignment.deleteMany({ videoId: row._id });

    // Optional: Remove from Cloudinary - FIXED COMPARISON
    const shouldDeleteFromCloudinary =
      deleteCloudinary.toLowerCase() === "true";
    if (shouldDeleteFromCloudinary && row.publicId) {
      try {
        await deleteCloudinaryVideo(row.publicId);
        console.log(`Deleted video from Cloudinary: ${row.publicId}`);
      } catch (cloudError) {
        // Log the error but don't fail the request
        console.error(
          "Error deleting video from Cloudinary:",
          cloudError.message,
        );
        // You might want to notify admin that Cloudinary deletion failed
      }
    }

    // Notify all connected devices that video was deleted
    broadcast({
      type: "VIDEO_DELETED",
      videoId: String(row._id),
      deletedFromCloudinary: shouldDeleteFromCloudinary,
    });

    return res.json({
      message: "Video and its assignments have been deleted",
      deletedFromCloudinary: shouldDeleteFromCloudinary,
      videoId: String(row._id),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
export const getOutletsForVideo = async (req, res) => {
  try {
    const { videoId } = req.params;

    // 1) Video details
    const video = await Video.findById(videoId).lean();
    if (!video) return res.status(404).json({ error: "Video not found" });

    // 2) All assignments for this video (optionally you can filter active only)
    const assignments = await OutletVideoAssignment.find({ videoId })
      .sort({ createdAt: -1 })
      .lean();

    if (!assignments || assignments.length === 0) {
      return res.json({
        video,
        totalAssignedOutlets: 0,
        assignments: [],
      });
    }

    // 3) Load all outlets referenced by assignments
    const outletIds = [...new Set(assignments.map((a) => String(a.outletId)))];

    const outlets = await Outlet.find({ _id: { $in: outletIds } }).lean();

    // Build quick lookup map outletId -> outlet
    const outletById = new Map(outlets.map((o) => [String(o._id), o]));

    // 4) Shape response: per-assignment include outlet + start/end
    const detailed = assignments
      .map((a) => {
        const outlet = outletById.get(String(a.outletId));
        if (!outlet) return null; // outlet deleted/missing

        return {
          outletAssigned: {
            assignmentId: String(a._id),
            active: a.active !== false,
            startAt: a.startAt ?? null,
            endAt: a.endAt ?? null,
            createdAt: a.createdAt ?? null,
            updatedAt: a.updatedAt ?? null,
          },
          outlet: {
            _id: String(outlet._id),
            code: outlet.code,
            name: outlet.name,
            location: outlet.location,
            siteValue: outlet.siteValue,
            active: outlet.active,
            createdAt: outlet.createdAt ?? null,
            updatedAt: outlet.updatedAt ?? null,
          },
        };
      })
      .filter(Boolean);

    return res.json({
      video: {
        _id: String(video._id),
        title: video.title,
        description: video.description,
        active: video.active,
        publicId: video.publicId,
        secureUrl: video.secureUrl, // ✅ important
        bytes: video.bytes,
        durationSec: video.durationSec,
        format: video.format,
        createdAt: video.createdAt ?? null,
        updatedAt: video.updatedAt ?? null,
      },
      totalAssignedOutlets: detailed.length,
      assignments: detailed,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
