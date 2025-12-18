import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    url: { type: String, required: true }, // /uploads/xxx.mp4
    mimeType: { type: String },
    size: { type: Number },
    checksum: { type: String },
    active: { type: Boolean, default: true }, // GLOBAL active/inactive (optional)
  },
  { timestamps: true }
);

const Media = mongoose.model("Media", mediaSchema);
export default Media;
