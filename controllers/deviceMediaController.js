// controllers/deviceMediaController.js
import Device from "../models/Device.js";
import Media from "../models/Media.js";
import DeviceMedia from "../models/DeviceMedia.js";
import mongoose from "mongoose";
import { sendToDeviceBoth, broadcast } from "../wsServer.js";

// Assign media to device (or update if exists)
// req.body.deviceId is the device CODE (ex: OUTLET-A)
export const upsertDeviceMedia = async (req, res) => {
  try {
    const { deviceId, mediaId, active = true, order = 0 } = req.body;

    if (!deviceId || !mediaId) {
      return res
        .status(400)
        .json({ error: "deviceId and mediaId are required" });
    }

    const device = await Device.findOne({ deviceId }).lean();
    if (!device) return res.status(404).json({ error: "Device not found" });

    const media = await Media.findById(mediaId).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    const deviceMongoId = String(device._id);
    const deviceCode = String(device.deviceId);

    const row = await DeviceMedia.findOneAndUpdate(
      { deviceId: deviceMongoId, mediaId },
      {
        deviceId: deviceMongoId,
        mediaId,
        active: !!active,
        order: Number(order) || 0,
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    const payload = {
      type: "DEVICE_MEDIA_UPDATED",
      action: "upsert",
      deviceCode,
      deviceMongoId,
      mediaId: String(mediaId),
      active: row.active,
      order: row.order,
    };

    sendToDeviceBoth({ deviceCode, deviceMongoId }, payload);
    broadcast(payload);

    res.json({ message: "Assigned/Updated", deviceMedia: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const listAllDeviceMedia = async (req, res) => {
  try {
    const filter = {};
    if (req.query.deviceId) filter.deviceId = req.query.deviceId;
    if (req.query.mediaId) filter.mediaId = req.query.mediaId;
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const rows = await DeviceMedia.find(filter)
      .sort({ deviceId: 1, order: 1, createdAt: 1 })
      .populate("deviceId", "deviceId name location")
      .populate("mediaId", "originalName url checksum active")
      .lean();

    const result = rows.map((r) => ({
      _id: r._id,
      device: r.deviceId
        ? {
            _id: r.deviceId._id,
            deviceId: r.deviceId.deviceId,
            name: r.deviceId.name,
            location: r.deviceId.location,
          }
        : null,
      media: r.mediaId
        ? {
            _id: r.mediaId._id,
            originalName: r.mediaId.originalName,
            url: r.mediaId.url,
            checksum: r.mediaId.checksum,
            globalActive: r.mediaId.active,
          }
        : null,
      active: r.active,
      order: r.order,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// List media assigned to a device (admin view)
// req.params.deviceId is the mongo id (stored in DeviceMedia.deviceId)
export const listDeviceMedia = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const assigned = await DeviceMedia.find({ deviceId })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const mediaIds = assigned.map((a) => a.mediaId);
    const medias = await Media.find({ _id: { $in: mediaIds } }).lean();
    const mediaMap = new Map(medias.map((m) => [String(m._id), m]));

    const result = assigned
      .map((a) => {
        const m = mediaMap.get(String(a.mediaId));
        if (!m) return null;
        return {
          deviceId: a.deviceId,
          mediaId: m._id,
          originalName: m.originalName,
          url: m.url,
          checksum: m.checksum,
          globalActive: m.active,
          active: a.active,
          order: a.order,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const bulkAssignMediaToDevices = async (req, res) => {
  try {
    const { mediaId, targets = [], order = 0, active = true } = req.body;

    if (!mediaId) return res.status(400).json({ error: "mediaId is required" });
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res
        .status(400)
        .json({ error: "mediaId must be a valid ObjectId" });
    }

    if (!Array.isArray(targets) || targets.length === 0) {
      return res
        .status(400)
        .json({ error: "targets must be a non-empty array" });
    }

    const media = await Media.findById(mediaId).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    const rawDeviceIds = targets.map((t) => t?.deviceId).filter(Boolean);

    const invalidIds = rawDeviceIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length) {
      return res.status(400).json({
        error: "Some deviceId values are not valid ObjectIds",
        invalidDeviceIds: invalidIds,
      });
    }

    const deviceMongoIds = [...new Set(rawDeviceIds.map(String))];

    const devices = await Device.find({ _id: { $in: deviceMongoIds } })
      .select("_id deviceId name location")
      .lean();

    const deviceMap = new Map(devices.map((d) => [String(d._id), d]));

    const assigned = [];
    const rejected = [];

    for (const t of targets) {
      const deviceMongoId = t?.deviceId ? String(t.deviceId) : null;
      if (!deviceMongoId) {
        rejected.push({ deviceId: null, reason: "Missing deviceId" });
        continue;
      }

      const device = deviceMap.get(deviceMongoId);
      if (!device) {
        rejected.push({ deviceId: deviceMongoId, reason: "Device not found" });
        continue;
      }

      const row = await DeviceMedia.findOneAndUpdate(
        { deviceId: deviceMongoId, mediaId },
        {
          deviceId: deviceMongoId,
          mediaId,
          active: !!active,
          order: Number(order) || 0,
        },
        { upsert: true, new: true, runValidators: true }
      ).lean();

      assigned.push(row);

      const payload = {
        type: "DEVICE_MEDIA_UPDATED",
        action: "bulk_upsert",
        deviceCode: String(device.deviceId),
        deviceMongoId,
        mediaId: String(mediaId),
        active: row.active,
        order: row.order,
      };

      sendToDeviceBoth({ deviceCode: device.deviceId, deviceMongoId }, payload);
      broadcast(payload);
    }

    res.json({
      message: "Bulk assigned",
      mediaId,
      assignedCount: assigned.length,
      assigned,
      rejected,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Update per-device active/order (single)
export const updateDeviceMedia = async (req, res) => {
  try {
    const { deviceId, mediaId } = req.params;
    const patch = {};

    if ("active" in req.body) patch.active = !!req.body.active;
    if ("order" in req.body) patch.order = Number(req.body.order) || 0;

    const row = await DeviceMedia.findOneAndUpdate(
      { deviceId, mediaId },
      patch,
      { new: true, runValidators: true }
    ).lean();

    if (!row) return res.status(404).json({ error: "Assignment not found" });

    const device = await Device.findById(deviceId)
      .select("_id deviceId")
      .lean();
    const deviceCode = device?.deviceId ? String(device.deviceId) : null;
    const deviceMongoId = String(deviceId);

    const payload = {
      type: "DEVICE_MEDIA_UPDATED",
      action: "update",
      deviceCode,
      deviceMongoId,
      mediaId: String(mediaId),
      active: row.active,
      order: row.order,
    };

    sendToDeviceBoth({ deviceCode, deviceMongoId }, payload);
    broadcast(payload);

    res.json({ message: "Updated", deviceMedia: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ✅ NEW: Bulk update deviceMedia for one media across many devices
// Route suggestion: PATCH /api/deviceMedia/media/:mediaId
// Body:
// {
//   "targets": [{ "deviceId": "..." }, ...],
//   "active": true,
//   "order": 5,
//   "upsert": false
// }
export const bulkUpdateDeviceMediaForTargets = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { targets = [], upsert = false } = req.body;

    if (!mediaId) return res.status(400).json({ error: "mediaId is required" });
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res
        .status(400)
        .json({ error: "mediaId must be a valid ObjectId" });
    }

    if (!Array.isArray(targets) || targets.length === 0) {
      return res
        .status(400)
        .json({ error: "targets must be a non-empty array" });
    }

    // ensure media exists
    const media = await Media.findById(mediaId).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    // build patch
    const patch = {};
    if ("active" in req.body) patch.active = !!req.body.active;
    if ("order" in req.body) patch.order = Number(req.body.order) || 0;

    if (Object.keys(patch).length === 0) {
      return res
        .status(400)
        .json({ error: "Nothing to update (active/order missing)" });
    }

    // validate device ids
    const rawDeviceIds = targets.map((t) => t?.deviceId).filter(Boolean);

    const invalidIds = rawDeviceIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length) {
      return res.status(400).json({
        error: "Some deviceId values are not valid ObjectIds",
        invalidDeviceIds: invalidIds,
      });
    }

    const deviceMongoIds = [...new Set(rawDeviceIds.map(String))];

    const devices = await Device.find({ _id: { $in: deviceMongoIds } })
      .select("_id deviceId")
      .lean();

    const deviceMap = new Map(devices.map((d) => [String(d._id), d]));

    const updated = [];
    const rejected = [];

    for (const deviceMongoId of deviceMongoIds) {
      const device = deviceMap.get(deviceMongoId);
      if (!device) {
        rejected.push({ deviceId: deviceMongoId, reason: "Device not found" });
        continue;
      }

      // update or upsert
      const row = await DeviceMedia.findOneAndUpdate(
        { deviceId: deviceMongoId, mediaId },
        upsert ? { ...patch, deviceId: deviceMongoId, mediaId } : patch,
        { new: true, runValidators: true, upsert: !!upsert }
      ).lean();

      if (!row) {
        // happens when upsert=false and assignment missing
        rejected.push({
          deviceId: deviceMongoId,
          reason: "Assignment not found",
        });
        continue;
      }

      updated.push(row);

      const payload = {
        type: "DEVICE_MEDIA_UPDATED",
        action: "bulk_update",
        deviceCode: String(device.deviceId),
        deviceMongoId: String(deviceMongoId),
        mediaId: String(mediaId),
        ...(row.active !== undefined ? { active: row.active } : {}),
        ...(row.order !== undefined ? { order: row.order } : {}),
      };

      sendToDeviceBoth({ deviceCode: device.deviceId, deviceMongoId }, payload);
      broadcast(payload);
    }

    res.json({
      message: "Bulk updated assignments",
      mediaId: String(mediaId),
      patch,
      upsert: !!upsert,
      updatedCount: updated.length,
      updated,
      rejected,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
export const syncMediaTargets = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { targets = [] } = req.body;

    if (!mediaId) return res.status(400).json({ error: "mediaId is required" });
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res
        .status(400)
        .json({ error: "mediaId must be a valid ObjectId" });
    }

    if (!Array.isArray(targets)) {
      return res.status(400).json({ error: "targets must be an array" });
    }

    // ensure media exists
    const media = await Media.findById(mediaId).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    // patch fields (optional but usually provided)
    const patch = {};
    if ("active" in req.body) patch.active = !!req.body.active;
    if ("order" in req.body) patch.order = Number(req.body.order) || 0;

    // normalize + validate target device ids
    const rawTargetIds = targets.map((t) => t?.deviceId).filter(Boolean);

    const invalidIds = rawTargetIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length) {
      return res.status(400).json({
        error: "Some deviceId values are not valid ObjectIds",
        invalidDeviceIds: invalidIds,
      });
    }

    // unique target mongo ids
    const targetDeviceMongoIds = [...new Set(rawTargetIds.map(String))];

    // load device docs so we can send deviceCode in WS
    const devices = await Device.find({ _id: { $in: targetDeviceMongoIds } })
      .select("_id deviceId")
      .lean();
    const deviceMap = new Map(devices.map((d) => [String(d._id), d]));

    // any missing device docs => reject
    const missingDevices = targetDeviceMongoIds.filter(
      (id) => !deviceMap.has(id)
    );
    if (missingDevices.length) {
      return res.status(404).json({
        error: "Some target devices not found",
        missingDeviceIds: missingDevices,
      });
    }

    // 1) Find all existing assignments for this media
    const existing = await DeviceMedia.find({ mediaId }).lean();
    const existingDeviceSet = new Set(existing.map((r) => String(r.deviceId)));
    const targetSet = new Set(targetDeviceMongoIds);

    // 2) Determine removals (in existing but not in target)
    const toRemoveDeviceIds = [...existingDeviceSet].filter(
      (d) => !targetSet.has(d)
    );

    // 3) Apply upserts for targets
    const upserted = [];
    for (const deviceMongoId of targetDeviceMongoIds) {
      const device = deviceMap.get(deviceMongoId);

      const row = await DeviceMedia.findOneAndUpdate(
        { deviceId: deviceMongoId, mediaId },
        {
          deviceId: deviceMongoId,
          mediaId,
          ...patch, // active/order if provided
        },
        { upsert: true, new: true, runValidators: true }
      ).lean();

      upserted.push(row);

      const payload = {
        type: "DEVICE_MEDIA_UPDATED",
        action: "sync_upsert",
        deviceCode: String(device.deviceId),
        deviceMongoId: String(deviceMongoId),
        mediaId: String(mediaId),
        ...(row?.active !== undefined ? { active: row.active } : {}),
        ...(row?.order !== undefined ? { order: row.order } : {}),
      };

      sendToDeviceBoth({ deviceCode: device.deviceId, deviceMongoId }, payload);
      broadcast(payload);
    }

    // 4) Remove assignments not in targets
    const removed = [];
    if (toRemoveDeviceIds.length) {
      // load device codes for removed devices (for WS)
      const removedDevices = await Device.find({
        _id: { $in: toRemoveDeviceIds },
      })
        .select("_id deviceId")
        .lean();
      const removedDeviceMap = new Map(
        removedDevices.map((d) => [String(d._id), d])
      );

      // delete rows
      const del = await DeviceMedia.deleteMany({
        mediaId,
        deviceId: { $in: toRemoveDeviceIds },
      });

      // record removed list (best effort)
      for (const deviceMongoId of toRemoveDeviceIds) {
        removed.push({ deviceId: deviceMongoId });
        const d = removedDeviceMap.get(deviceMongoId);

        const payload = {
          type: "DEVICE_MEDIA_UPDATED",
          action: "sync_remove",
          deviceCode: d?.deviceId ? String(d.deviceId) : null,
          deviceMongoId: String(deviceMongoId),
          mediaId: String(mediaId),
        };

        sendToDeviceBoth({ deviceCode: d?.deviceId, deviceMongoId }, payload);
        broadcast(payload);
      }

      console.log("[syncMediaTargets] removedCount:", del.deletedCount);
    }

    res.json({
      message: "Synced media targets",
      mediaId: String(mediaId),
      patch,
      targetCount: targetDeviceMongoIds.length,
      removedCount: toRemoveDeviceIds.length,
      upserted,
      removed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
// Remove media from device
export const removeDeviceMedia = async (req, res) => {
  try {
    const { deviceId, mediaId } = req.params;

    const deleted = await DeviceMedia.findOneAndDelete({
      deviceId,
      mediaId,
    }).lean();
    if (!deleted)
      return res.status(404).json({ error: "Assignment not found" });

    const device = await Device.findById(deviceId)
      .select("_id deviceId")
      .lean();
    const deviceCode = device?.deviceId ? String(device.deviceId) : null;
    const deviceMongoId = String(deviceId);

    const payload = {
      type: "DEVICE_MEDIA_UPDATED",
      action: "remove",
      deviceCode,
      deviceMongoId,
      mediaId: String(mediaId),
    };

    sendToDeviceBoth({ deviceCode, deviceMongoId }, payload);
    broadcast(payload);

    res.json({ message: "Removed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
