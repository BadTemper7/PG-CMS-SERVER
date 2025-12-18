import mongoose from "mongoose";

const playlistItemSchema = new mongoose.Schema(
  {
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      required: true,
    },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    items: { type: [playlistItemSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
const Playlist = mongoose.model("Playlist", playlistSchema);
export default Playlist;
