import Outlet from "../models/Outlet.js";
import Terminal from "../models/Terminal.js";
import { sendToDeviceBoth } from "../wsServer.js";
import mongoose from "mongoose";

export const createTerminal = async (req, res) => {
  try {
    const { outletId } = req.params;
    const { code, description, deviceKey, active = true } = req.body;

    if (!code || !deviceKey) {
      return res.status(400).json({ error: "code and deviceKey are required" });
    }

    const outlet = await Outlet.findById(outletId).lean();
    if (!outlet) return res.status(404).json({ error: "Outlet not found" });

    const existsKey = await Terminal.findOne({ deviceKey }).lean();
    if (existsKey)
      return res.status(409).json({ error: "deviceKey already exists" });

    const terminal = await Terminal.create({
      outletId,
      code,
      description,
      deviceKey,
      active: !!active,
    });

    return res.json(terminal);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
export const createMultipleTerminals = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { outletId } = req.params;
    const { count = 1, descriptionPrefix = "Display" } = req.body;

    if (count < 1 || count > 50) {
      await session.abortTransaction();
      return res.status(400).json({ error: "Count must be between 1 and 50" });
    }

    const outlet = await Outlet.findById(outletId).session(session).lean();
    if (!outlet) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Outlet not found" });
    }

    // ✅ Generate all terminal codes at once
    const terminalCodes = await Terminal.generateTerminalCodes(outletId, count);

    const createdTerminals = [];

    // ✅ Create terminals sequentially within the transaction
    for (let i = 0; i < count; i++) {
      const code = terminalCodes[i];
      const deviceKey = Terminal.generateDeviceKey(outlet.code, code);

      const terminal = new Terminal({
        outletId,
        code,
        description: `${descriptionPrefix} ${code}`,
        deviceKey,
        active: true,
        isOnline: false,
      });

      await terminal.save({ session });
      createdTerminals.push(terminal.toObject());
    }

    await session.commitTransaction();

    console.log(
      `[CREATE_MULTIPLE] Created ${count} terminals for outlet ${outlet.code}: ${terminalCodes.join(", ")}`,
    );

    return res.json({
      success: true,
      count: createdTerminals.length,
      terminals: createdTerminals,
      codes: terminalCodes,
      message: `${count} terminal(s) created successfully: ${terminalCodes.join(", ")}`,
    });
  } catch (e) {
    await session.abortTransaction();
    console.error("[CREATE_MULTIPLE] Error:", e.message);

    // Handle duplicate key error
    if (e.code === 11000) {
      const field = e.keyPattern ? Object.keys(e.keyPattern)[0] : "unknown";
      return res.status(400).json({
        error: `Duplicate ${field} error`,
        details: `A terminal with this ${field} already exists. Please try again.`,
      });
    }

    return res.status(500).json({ error: e.message });
  } finally {
    session.endSession();
  }
};

export const listTerminals = async (req, res) => {
  try {
    const filter = {};
    if (req.query.outletId) filter.outletId = req.query.outletId;
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const rows = await Terminal.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const getTerminal = async (req, res) => {
  try {
    const row = await Terminal.findById(req.params.terminalId).lean();
    if (!row) return res.status(404).json({ error: "Terminal not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const updateTerminal = async (req, res) => {
  try {
    const row = await Terminal.findByIdAndUpdate(
      req.params.terminalId,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!row) return res.status(404).json({ error: "Terminal not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
// In terminalController.js
// controllers/terminalController.js
export const heartbeatTerminal = async (req, res) => {
  try {
    const { deviceKey } = req.body;

    if (!deviceKey) {
      return res.status(400).json({ error: "deviceKey is required" });
    }

    // Find terminal by deviceKey
    const terminal = await Terminal.findOne({ deviceKey });

    if (!terminal) {
      return res.status(404).json({ error: "Terminal not found" });
    }

    const now = new Date();
    const wasOffline = !terminal.isOnline;

    // Update the lastSeenAt timestamp and mark as online
    const updatedTerminal = await Terminal.findByIdAndUpdate(
      terminal._id,
      {
        lastSeenAt: now,
        isOnline: true,
        "lastStatus.updatedAt": now,
      },
      { new: true, runValidators: true },
    ).lean();

    console.log(
      `[HEARTBEAT] Terminal ${terminal.code} (${deviceKey}) is online`,
    );

    // Broadcast to WebSocket clients when terminal comes online
    if (wasOffline) {
      sendToDeviceBoth(
        {
          deviceCode: terminal.code,
          deviceMongoId: terminal._id.toString(),
        },
        {
          type: "TERMINAL_STATUS_UPDATE",
          data: {
            terminalId: terminal._id,
            isOnline: true,
            lastSeenAt: now,
            updatedAt: now,
          },
        },
      );

      // Also broadcast to all clients (for admin panel)
      broadcast({
        type: "TERMINAL_HEARTBEAT",
        data: {
          terminalId: terminal._id,
          deviceKey: deviceKey,
          lastSeenAt: now,
          isOnline: true,
        },
      });

      console.log(
        `[HEARTBEAT] Broadcasted online status for terminal ${terminal.code}`,
      );
    } else {
      // Still send heartbeat update but don't broadcast to everyone (only to specific device)
      sendToDeviceBoth(
        {
          deviceCode: terminal.code,
          deviceMongoId: terminal._id.toString(),
        },
        {
          type: "TERMINAL_HEARTBEAT",
          data: {
            terminalId: terminal._id,
            deviceKey: deviceKey,
            lastSeenAt: now,
            isOnline: true,
          },
        },
      );
    }

    return res.json(updatedTerminal);
  } catch (e) {
    console.error("[HEARTBEAT] Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};
export const removeTerminal = async (req, res) => {
  try {
    const row = await Terminal.findByIdAndDelete(req.params.terminalId).lean();
    if (!row) return res.status(404).json({ error: "Terminal not found" });
    return res.json({ message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
