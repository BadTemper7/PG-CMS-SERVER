import Assignment from "../models/Assignment.js";
import { broadcast } from "../wsServer.js";

export const assignPlaylistToDevice = async (req, res) => {
  try {
    const { deviceId, playlistId } = req.body;
    if (!deviceId || !playlistId)
      return res
        .status(400)
        .json({ error: "deviceId and playlistId required" });

    const existing = await Assignment.findOne({ deviceId });

    const assignment = await Assignment.findOneAndUpdate(
      { deviceId },
      {
        deviceId,
        playlistId,
        version: existing ? existing.version + 1 : 1,
      },
      { upsert: true, new: true, runValidators: true }
    );

    broadcast({
      type: "ASSIGNMENT_UPDATED",
      deviceId,
      playlistId,
      version: assignment.version,
    });

    res.json({ message: "Assigned", assignment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
