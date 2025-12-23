import mongoose from "mongoose";

const deviceMediaSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      required: true,
      index: true,
    },
    active: { type: Boolean, default: true },
    start_date: { type: Date },
    end_date: { type: Date },
  },
  { timestamps: true }
);

deviceMediaSchema.index({ deviceId: 1, mediaId: 1 }, { unique: true });

export default mongoose.model("DeviceMedia", deviceMediaSchema);
