// controllers/deviceMediaController.js
import Device from "../models/Device.js";
import Media from "../models/Media.js";
import DeviceMedia from "../models/DeviceMedia.js";
import mongoose from "mongoose";
import { sendToDeviceBoth, broadcast } from "../wsServer.js";

// ---------- helpers ----------
const parseOptionalDate = (v) => {
  if (v === undefined) return undefined; // "not provided" (do not change)
  if (v === null || v === "") return null; // explicit clear
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "INVALID_DATE" : d;
};

const normalizeStartEnd = (body) => {
  const start = parseOptionalDate(body.start_date);
  const end = parseOptionalDate(body.end_date);

  if (start === "INVALID_DATE") return { error: "start_date is invalid" };
  if (end === "INVALID_DATE") return { error: "end_date is invalid" };

  // If both provided (and not null), enforce end >= start
  if (start instanceof Date && end instanceof Date && end < start) {
    return { error: "end_date must be >= start_date" };
  }

  return { start_date: start, end_date: end };
};

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

    const { start_date, end_date, error } = normalizeStartEnd(req.body);
    if (error) return res.status(400).json({ error });

    const deviceMongoId = String(device._id);
    const deviceCode = String(device.deviceId);

    const updateDoc = {
      deviceId: deviceMongoId,
      mediaId,
      active: !!active,
      order: Number(order) || 0,
    };

    // only set if provided; allow explicit null to clear
    if (start_date !== undefined) updateDoc.start_date = start_date;
    if (end_date !== undefined) updateDoc.end_date = end_date;

    const row = await DeviceMedia.findOneAndUpdate(
      { deviceId: deviceMongoId, mediaId },
      updateDoc,
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
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
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
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
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
          start_date: a.start_date ?? null,
          end_date: a.end_date ?? null,
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

      // ✅ READ DATES FROM TARGET ITEM (NOT req.body)
      const { start_date, end_date, error } = normalizeStartEnd(t);
      if (error) {
        rejected.push({ deviceId: deviceMongoId, reason: error });
        continue;
      }

      const updateDoc = {
        deviceId: deviceMongoId,
        mediaId,
        active: !!active,
        order: Number(t?.order ?? order) || 0, // allow per-target order override if you want
      };

      if (start_date !== undefined) updateDoc.start_date = start_date; // Date or null
      if (end_date !== undefined) updateDoc.end_date = end_date;

      const row = await DeviceMedia.findOneAndUpdate(
        { deviceId: deviceMongoId, mediaId },
        updateDoc,
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
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
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

// Update per-device active/order/dates (single)
export const updateDeviceMedia = async (req, res) => {
  try {
    const { deviceId, mediaId } = req.params;
    const patch = {};

    if ("active" in req.body) patch.active = !!req.body.active;
    if ("order" in req.body) patch.order = Number(req.body.order) || 0;

    const { start_date, end_date, error } = normalizeStartEnd(req.body);
    if (error) return res.status(400).json({ error });

    if (start_date !== undefined) patch.start_date = start_date;
    if (end_date !== undefined) patch.end_date = end_date;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

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
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
    };

    sendToDeviceBoth({ deviceCode, deviceMongoId }, payload);
    broadcast(payload);

    res.json({ message: "Updated", deviceMedia: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Bulk update deviceMedia for one media across many devices
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

    const media = await Media.findById(mediaId).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    const patch = {};
    if ("active" in req.body) patch.active = !!req.body.active;
    if ("order" in req.body) patch.order = Number(req.body.order) || 0;

    const { start_date, end_date, error } = normalizeStartEnd(req.body);
    if (error) return res.status(400).json({ error });

    if (start_date !== undefined) patch.start_date = start_date;
    if (end_date !== undefined) patch.end_date = end_date;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error: "Nothing to update (active/order/start_date/end_date missing)",
      });
    }

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

      const row = await DeviceMedia.findOneAndUpdate(
        { deviceId: deviceMongoId, mediaId },
        upsert ? { ...patch, deviceId: deviceMongoId, mediaId } : patch,
        { new: true, runValidators: true, upsert: !!upsert }
      ).lean();

      if (!row) {
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
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
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

    const media = await Media.findById(mediaId).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    // ✅ only global fields here
    const patchBase = {};
    if ("active" in req.body) patchBase.active = !!req.body.active;
    if ("order" in req.body) patchBase.order = Number(req.body.order) || 0;

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

    const targetDeviceMongoIds = [...new Set(rawTargetIds.map(String))];

    const devices = await Device.find({ _id: { $in: targetDeviceMongoIds } })
      .select("_id deviceId")
      .lean();
    const deviceMap = new Map(devices.map((d) => [String(d._id), d]));

    const missingDevices = targetDeviceMongoIds.filter(
      (id) => !deviceMap.has(id)
    );
    if (missingDevices.length) {
      return res.status(404).json({
        error: "Some target devices not found",
        missingDeviceIds: missingDevices,
      });
    }

    const existing = await DeviceMedia.find({ mediaId }).lean();
    const existingDeviceSet = new Set(existing.map((r) => String(r.deviceId)));
    const targetSet = new Set(targetDeviceMongoIds);

    const toRemoveDeviceIds = [...existingDeviceSet].filter(
      (d) => !targetSet.has(d)
    );

    const upserted = [];

    for (const deviceMongoId of targetDeviceMongoIds) {
      const device = deviceMap.get(deviceMongoId);

      // ✅ find the matching target object and normalize dates from it
      const t =
        targets.find((x) => String(x?.deviceId) === String(deviceMongoId)) ||
        {};

      const { start_date, end_date, error } = normalizeStartEnd(t);
      if (error) {
        // If one target has bad date, stop and return error (or you can reject only that target)
        return res.status(400).json({ error, deviceId: deviceMongoId });
      }

      const patch = {
        ...patchBase,
        // allow per-target overrides if you want:
        ...(t?.active !== undefined ? { active: !!t.active } : {}),
        ...(t?.order !== undefined ? { order: Number(t.order) || 0 } : {}),
      };

      if (start_date !== undefined) patch.start_date = start_date;
      if (end_date !== undefined) patch.end_date = end_date;

      const row = await DeviceMedia.findOneAndUpdate(
        { deviceId: deviceMongoId, mediaId },
        { deviceId: deviceMongoId, mediaId, ...patch },
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
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
      };

      sendToDeviceBoth({ deviceCode: device.deviceId, deviceMongoId }, payload);
      broadcast(payload);
    }

    const removed = [];
    if (toRemoveDeviceIds.length) {
      const removedDevices = await Device.find({
        _id: { $in: toRemoveDeviceIds },
      })
        .select("_id deviceId")
        .lean();

      const removedDeviceMap = new Map(
        removedDevices.map((d) => [String(d._id), d])
      );

      const del = await DeviceMedia.deleteMany({
        mediaId,
        deviceId: { $in: toRemoveDeviceIds },
      });

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
      patchBase,
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
