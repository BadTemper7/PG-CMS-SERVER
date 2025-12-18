import Device from "../models/Device.js";
import Assignment from "../models/Assignment.js";
import Playlist from "../models/Playlist.js";
import Media from "../models/Media.js";
import { broadcast } from "../wsServer.js";
import { generateToken, hashToken } from "../utils/deviceToken.js";

const OFFLINE_SECONDS = 90;

export const registerDevice = async (req, res) => {
  try {
    const { deviceId, name, location } = req.body;
    if (!deviceId)
      return res.status(400).json({ error: "deviceId is required" });

    const token = generateToken();
    const tokenHash = hashToken(token);

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { deviceId, name, location, tokenHash, lastSeenAt: new Date() },
      { upsert: true, new: true, runValidators: true }
    );

    broadcast({ type: "DEVICE_UPDATED", action: "register", deviceId });

    // return token ONCE (player stores it)
    res.status(201).json({ deviceId: device.deviceId, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// very simple auth: device must send x-device-token
const assertDeviceAuth = async (req) => {
  const token = req.headers["x-device-token"];
  if (!token) throw new Error("Missing x-device-token");
  const tokenHash = hashToken(token);

  const device = await Device.findOne({
    deviceId: req.params.deviceId,
    tokenHash,
  });
  if (!device) throw new Error("Invalid device token");
  return device;
};

export const heartbeat = async (req, res) => {
  try {
    const device = await assertDeviceAuth(req);
    device.lastSeenAt = new Date();
    // keep lastState as-is
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

    device.lastSeenAt = new Date();
    if (state) device.lastState = state;
    if (currentMediaId) device.currentMediaId = currentMediaId;
    if (currentMediaName) device.currentMediaName = currentMediaName;
    if (state === "playing") {
      device.lastPlaybackAt = new Date();
    }
    await device.save();

    broadcast({
      type: "DEVICE_STATUS",
      deviceId: device.deviceId,
      state: device.lastState,
      currentMediaName,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

export const getDeviceConfig = async (req, res) => {
  try {
    const device = await assertDeviceAuth(req);

    // assignment
    const assignment = await Assignment.findOne({ deviceId: device.deviceId });
    let playlist = null;

    if (assignment) {
      playlist = await Playlist.findById(assignment.playlistId).lean();
    }

    // populate media URLs
    let items = [];
    if (playlist?.items?.length) {
      const mediaIds = playlist.items.map((x) => x.mediaId);
      const medias = await Media.find({
        _id: { $in: mediaIds },
        active: true,
      }).lean();

      const mediaMap = new Map(medias.map((m) => [String(m._id), m]));
      items = playlist.items
        .sort((a, b) => a.order - b.order)
        .map((it) => {
          const m = mediaMap.get(String(it.mediaId));
          return m
            ? {
                mediaId: m._id,
                url: m.url,
                checksum: m.checksum,
                originalName: m.originalName,
              }
            : null;
        })
        .filter(Boolean);
    }

    // default fallback
    let defaultMedia = null;
    if (device.defaultMediaId)
      defaultMedia = await Media.findById(device.defaultMediaId).lean();

    res.json({
      deviceId: device.deviceId,
      assignmentVersion: assignment?.version || 0,
      playlistItems: items,
      defaultVideo: defaultMedia
        ? {
            mediaId: defaultMedia._id,
            url: defaultMedia.url,
            checksum: defaultMedia.checksum,
          }
        : null,
      offlineSeconds: OFFLINE_SECONDS,
    });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

// Admin view
export const listDevices = async (req, res) => {
  const devices = await Device.find().sort({ updatedAt: -1 }).lean();
  const now = Date.now();

  const withStatus = devices.map((d) => {
    const last = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
    const offline = !last || (now - last) / 1000 > OFFLINE_SECONDS;
    const status = offline
      ? "offline"
      : d.lastState === "playing"
      ? "playing"
      : "active";
    return { ...d, status };
  });

  res.json(withStatus);
};
