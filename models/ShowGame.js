import mongoose from "mongoose";

const showGameSchema = new mongoose.Schema(
  {
    showNumber: { type: Number, required: true },
    gameTab: {
      type: String,
      enum: ["top", "hot"],
      default: "top",
    },
  },
  { timestamps: true }
);

const ShowGame = mongoose.model("ShowGame", showGameSchema);

export default ShowGame;
