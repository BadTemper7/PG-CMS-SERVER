import Device from "../models/Device.js";
import Media from "../models/Media.js";
import DeviceMedia from "../models/DeviceMedia.js";
import mongoose from "mongoose";
import { sendToDeviceBoth, broadcast } from "../wsServer.js";

export const upsertDeviceMedia = async (req, res) => {
  try {
    const { deviceId, mediaId, active = true, order = 0 } = req.body;
    if (!deviceId || !mediaId) {
      return res
        .status(400)
        .json({ error: "deviceId and mediaId are required" });
    }

    // deviceId from body is device code like OUTLET-A
    const device = await Device.findOne({ deviceId }).lean();
    if (!device) return res.status(404).json({ error: "Device not found" });

    const media = await Media.findById(mediaId).lean();
    if (!media) return res.status(404).json({ error: "Media not found" });

    const deviceMongoId = String(device._id);
    const deviceCode = device.deviceId;

    // ✅ store mongo id in DeviceMedia.deviceId (because you populate deviceId later)
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

    // ✅ send only to this device (player)
    sendToDeviceBoth({ deviceCode, deviceMongoId }, payload);

    // optional: also broadcast to admin dashboards
    broadcast(payload);

    res.json({ message: "Assigned/Updated", deviceMedia: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const listAllDeviceMedia = async (req, res) => {
  try {
    // optional filters:
    // /api/deviceMedia/all?deviceId=<Device ObjectId>&mediaId=<Media ObjectId>&active=true|false
    const filter = {};

    if (req.query.deviceId) filter.deviceId = req.query.deviceId;
    if (req.query.mediaId) filter.mediaId = req.query.mediaId;
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const rows = await DeviceMedia.find(filter)
      .sort({ deviceId: 1, order: 1, createdAt: 1 })
      .populate("deviceId", "deviceId name location") // deviceId here is the Device doc
      .populate("mediaId", "originalName url checksum active") // media doc
      .lean();

    // flatten the response (easier for admin UI)
    const result = rows.map((r) => ({
      _id: r._id,

      device: r.deviceId
        ? {
            _id: r.deviceId._id,
            deviceId: r.deviceId.deviceId, // human code like OUTLET-A
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

      active: r.active, // per-device active
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
        deviceCode: device.deviceId,
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

// Update per-device active/order
export const updateDeviceMedia = async (req, res) => {
  try {
    const { deviceId, mediaId } = req.params; // deviceId here = mongo id string
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
    const deviceCode = device?.deviceId || null;
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

export const removeDeviceMedia = async (req, res) => {
  try {
    const { deviceId, mediaId } = req.params; // deviceId = mongo id string

    const deleted = await DeviceMedia.findOneAndDelete({
      deviceId,
      mediaId,
    }).lean();
    if (!deleted)
      return res.status(404).json({ error: "Assignment not found" });

    const device = await Device.findById(deviceId)
      .select("_id deviceId")
      .lean();
    const deviceCode = device?.deviceId || null;
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
