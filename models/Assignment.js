import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
    },
    version: { type: Number, default: 1 }, // increment whenever changed
  },
  { timestamps: true }
);
const Assignment = mongoose.model("Assignment", assignmentSchema);
export default Assignment;
