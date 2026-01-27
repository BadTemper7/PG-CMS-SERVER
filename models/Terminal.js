// models/Terminal.js
import mongoose from "mongoose";
import crypto from "crypto";

const terminalSchema = new mongoose.Schema(
  {
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outlet",
      required: true,
      index: true,
    },

    code: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },

    deviceKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    active: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    lastStatus: {
      isPlaying: { type: Boolean, default: false },
      videoUrl: { type: String, default: "" },
      positionSec: { type: Number, default: 0 },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

terminalSchema.index({ outletId: 1, code: 1 }, { unique: true });

// ✅ Generate device key (unchanged)
terminalSchema.statics.generateDeviceKey = function (outletCode, terminalCode) {
  const uniqueString = `${outletCode}-${terminalCode}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const hash = crypto.createHash("sha256");
  hash.update(uniqueString);
  return hash.digest("hex").substring(0, 32);
};

// ✅ NEW: Get the next available terminal number for an outlet
terminalSchema.statics.getNextTerminalNumber = async function (outletId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the highest terminal number for this outlet
    const lastTerminal = await this.findOne({ outletId })
      .sort({ code: -1 })
      .select("code")
      .session(session)
      .lean();

    let nextNumber = 1;

    if (lastTerminal && lastTerminal.code) {
      const match = lastTerminal.code.match(/T(\d+)$/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    await session.commitTransaction();
    return nextNumber;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ✅ NEW: Generate multiple terminal codes at once
terminalSchema.statics.generateTerminalCodes = async function (
  outletId,
  count,
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the highest terminal number for this outlet
    const lastTerminal = await this.findOne({ outletId })
      .sort({ code: -1 })
      .select("code")
      .session(session)
      .lean();

    let startNumber = 1;

    if (lastTerminal && lastTerminal.code) {
      const match = lastTerminal.code.match(/T(\d+)$/);
      if (match && match[1]) {
        startNumber = parseInt(match[1]) + 1;
      }
    }

    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(`T${startNumber + i}`);
    }

    await session.commitTransaction();
    return codes;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export default mongoose.model("Terminal", terminalSchema);
