// controllers/deviceController.js
import Device from "../models/Device.js";
import Media from "../models/Media.js";
import DeviceMedia from "../models/DeviceMedia.js";
import { broadcast } from "../wsServer.js";
import { generateToken, hashToken } from "../utils/deviceToken.js";

const OFFLINE_SECONDS = 15;

export const registerDevice = async (req, res) => {
  try {
    const { deviceId, name, location } = req.body;
    if (!deviceId)
      return res.status(400).json({ error: "deviceId is required" });

    const token = generateToken();
    const tokenHash = hashToken(token);

    const device = await Device.findOneAndUpdate(
      { deviceId },
      {
        $set: { deviceId, name, location, tokenHash },
        $setOnInsert: { lastState: "idle" },
      },
      { upsert: true, new: true, runValidators: true }
    );

    broadcast({ type: "DEVICE_UPDATED", action: "register", deviceId });

    res.status(201).json({ deviceId: device.deviceId, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const resetDeviceToken = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) return res.status(404).json({ error: "Device not found" });

    const token = generateToken();
    device.tokenHash = hashToken(token);

    // ✅ do NOT touch lastSeenAt
    await device.save();

    broadcast({ type: "DEVICE_UPDATED", action: "token_reset", deviceId });

    // return token ONCE
    res.json({ deviceId, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// auth: device must send x-device-token
const assertDeviceAuth = async (req) => {
  const token = req.headers["x-device-token"];
  if (!token) throw new Error("Missing x-device-token");

  const hashed = hashToken(token);

  const device = await Device.findOne({
    deviceId: req.params.deviceId,
    $or: [
      { tokenHash: hashed }, // normal (DB stores hash)
      { tokenHash: token }, // fallback (if DB accidentally stores raw, or client sends hash)
    ],
  });

  if (!device) throw new Error("Invalid device token");
  return device;
};

export const heartbeat = async (req, res) => {
  try {
    const device = await assertDeviceAuth(req);
    device.lastSeenAt = new Date();
    await device.save();

    broadcast({
      type: "DEVICE_HEARTBEAT",
      deviceId: device.deviceId,
      lastSeenAt: device.lastSeenAt,
    });

    res.json({ ok: true, lastSeenAt: device.lastSeenAt });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

export const updatePlaybackStatus = async (req, res) => {
  try {
    const device = await assertDeviceAuth(req);
    const { state, currentMediaId, currentMediaName } = req.body;

    if (state) {
      if (!["idle", "playing"].includes(state)) {
        return res.status(400).json({ error: "Invalid state" });
      }
      device.lastState = state;
    }

    if (currentMediaId) device.currentMediaId = currentMediaId;
    if (currentMediaName) device.currentMediaName = currentMediaName;

    if (device.lastState === "playing") {
      device.lastPlaybackAt = new Date();

      // ✅ liveness while playing (optional)
      device.lastSeenAt = new Date();
    }

    await device.save();

    broadcast({
      type: "DEVICE_STATUS",
      deviceId: device.deviceId,
      state: device.lastState,
      currentMediaName: device.currentMediaName || null,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

// Player pulls its media list (assigned to THIS device)
export const getDeviceConfig = async (req, res) => {
  try {
    const device = await assertDeviceAuth(req);

    // get assigned media for device (active per-device)
    const assignments = await DeviceMedia.find({
      deviceId: device._id,
      active: true,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const mediaIds = assignments.map((a) => a.mediaId);

    // only return media that is globally active too
    const medias = await Media.find({
      _id: { $in: mediaIds },
      active: true,
    }).lean();

    const mediaMap = new Map(medias.map((m) => [String(m._id), m]));

    // ✅ IMPORTANT: include start_date / end_date from assignment rows
    const items = assignments
      .map((a) => {
        const m = mediaMap.get(String(a.mediaId));
        if (!m) return null;

        // ✅ FIX: prefer Cloudinary secure URL when available
        const url = m.cloudinarySecureUrl || m.url;

        if (!url) return null; // safeguard: don’t send broken entries

        return {
          mediaId: String(m._id),
          url,
          checksum: m.checksum,
          originalName: m.originalName,
          order: Number(a.order) || 0,

          // ✅ schedule (ISO strings or null)
          start_date: a.start_date
            ? new Date(a.start_date).toISOString()
            : null,
          end_date: a.end_date ? new Date(a.end_date).toISOString() : null,

          // (optional) helps debugging; does not affect player if you ignore it
          active: m.active === true,
        };
      })
      .filter(Boolean);

    // fallback default
    let defaultMedia = null;
    if (device.defaultMediaId) {
      defaultMedia = await Media.findById(device.defaultMediaId).lean();
      if (defaultMedia && defaultMedia.active === false) defaultMedia = null;
    }

    res.json({
      deviceId: device.deviceId,
      items,
      defaultVideo: defaultMedia
        ? {
            mediaId: String(defaultMedia._id),
            url: defaultMedia.cloudinarySecureUrl || defaultMedia.url, // ✅ also fix here
            checksum: defaultMedia.checksum,
            originalName: defaultMedia.originalName,
            active: defaultMedia.active === true, // optional
          }
        : null,
      offlineSeconds: OFFLINE_SECONDS,
    });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

// Admin: list devices with computed status
export const listDevices = async (req, res) => {
  const devices = await Device.find().sort({ updatedAt: -1 }).lean();
  const now = Date.now();

  const withStatus = devices.map((d) => {
    const last = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
    const offline = !last || (now - last) / 1000 > OFFLINE_SECONDS;

    // ✅ only online/offline
    const status = offline ? "offline" : "online";

    return { ...d, status };
  });

  res.json(withStatus);
};
