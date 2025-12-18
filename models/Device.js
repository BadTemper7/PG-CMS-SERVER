import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true }, // STORE1-TV1
    name: { type: String },
    location: { type: String },

    tokenHash: { type: String, required: true }, // store hash only

    lastSeenAt: { type: Date },
    lastState: { type: String, enum: ["idle", "playing"], default: "idle" },
    lastPlaybackAt: { type: Date },

    currentMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
    currentMediaName: { type: String },

    defaultMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" }, // optional fallback
  },
  { timestamps: true }
);

const Device = mongoose.model("Device", deviceSchema);
export default Device;
