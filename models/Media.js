import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true }, // stored filename on server
    url: { type: String, required: true }, // /uploads/xxx.mp4
    mimeType: { type: String },
    size: { type: Number },
    checksum: { type: String }, // optional but recommended
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
const Media = mongoose.model("Media", mediaSchema);
export default Media;
