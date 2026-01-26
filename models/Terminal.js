import mongoose from "mongoose";

const terminalSchema = new mongoose.Schema(
  {
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outlet",
      required: true,
      index: true,
    },

    code: { type: String, required: true, trim: true, index: true }, // terminal code/name
    description: { type: String, trim: true },

    // used by terminal app to connect to ws/authenticate (like deviceKey)
    deviceKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    active: { type: Boolean, default: true },

    // optional status cache (if you later send heartbeat messages)
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

export default mongoose.model("Terminal", terminalSchema);
