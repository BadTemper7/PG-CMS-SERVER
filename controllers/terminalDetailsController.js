import Terminal from "../models/Terminal.js";
import Outlet from "../models/Outlet.js";
import OutletVideoAssignment from "../models/OutletVideoAssignment.js";
import { pickActiveAssignment } from "../services/playbackService.js";
import Video from "../models/Video.js";

const OFFLINE_MS = 15000;

function isActiveWindow({ startAt, endAt }, nowMs) {
  const s = startAt ? new Date(startAt).getTime() : null;
  const e = endAt ? new Date(endAt).getTime() : null;
  if (s && nowMs < s) return false;
  if (e && nowMs > e) return false;
  return true;
}
export const getTerminalDetails = async (req, res) => {
  try {
    const { terminalId } = req.params;

    const terminal = await Terminal.findById(terminalId).lean();
    if (!terminal) return res.status(404).json({ error: "Terminal not found" });

    const outlet = await Outlet.findById(terminal.outletId).lean();
    if (!outlet) return res.status(404).json({ error: "Outlet not found" });

    const nowMs = Date.now();

    // ✅ Fetch ALL assignments for this outlet
    const assignments = await OutletVideoAssignment.find({
      outletId: outlet._id,
      active: true,
    })
      .sort({ createdAt: 1 }) // play order oldest -> newest (change if you prefer)
      .lean();

    // ✅ Join videos
    const videoIds = assignments.map((a) => a.videoId);
    const videos = await Video.find({ _id: { $in: videoIds } }).lean();
    const byId = new Map(videos.map((v) => [String(v._id), v]));

    // ✅ Build playlist with date-window filtering info
    const playlist = assignments
      .map((a) => {
        const v = byId.get(String(a.videoId));
        if (!v) return null;

        // ✅ NEW: skip inactive videos
        if (v.active === false) return null;

        return {
          assignmentId: a._id,
          startAt: a.startAt ?? null,
          endAt: a.endAt ?? null,
          isActiveNow: isActiveWindow(a, nowMs),
          video: {
            id: v._id,
            title: v.title,
            url: v.secureUrl,
            durationSec: v.durationSec,
            format: v.format,
            bytes: v.bytes,
            active: v.active, // optional for debugging
          },
        };
      })
      .filter(Boolean);

    const isOnline =
      !!terminal.lastSeenAt &&
      nowMs - new Date(terminal.lastSeenAt).getTime() <= OFFLINE_MS;

    return res.json({
      terminal,
      outlet,
      playlist, // ✅ NEW
      isOnline,
      offlineThresholdMs: OFFLINE_MS,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const updateTerminalStatus = async (req, res) => {
  try {
    const { terminalId } = req.params;

    const {
      isPlaying = false,
      videoUrl = "",
      positionSec = 0,
      hasError = false,
      displayId = null,
    } = req.body || {};

    const now = new Date();

    const updated = await Terminal.findByIdAndUpdate(
      terminalId,
      {
        $set: {
          lastSeenAt: now,
          lastStatus: {
            isPlaying: !!isPlaying,
            videoUrl: String(videoUrl || ""),
            positionSec: Number(positionSec || 0),
            hasError: !!hasError,
            displayId,
            updatedAt: now,
          },
        },
      },
      { new: true },
    ).lean();

    if (!updated) return res.status(404).json({ error: "Terminal not found" });

    // Optional: notify dashboards
    sendToDevice(updated.outletId?.toString?.() || "", {
      type: "TERMINAL_STATUS",
      terminalId: updated._id,
      lastSeenAt: updated.lastSeenAt,
      lastStatus: updated.lastStatus,
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
