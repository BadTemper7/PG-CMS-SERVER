import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true,
    },
    gameName: {
      type: String,
      required: true,
    },
    gameImg: {
      type: String,
      required: true,
    },
    gameDemo: {
      type: String,
      default: "",
    },
    gameCategory: {
      type: Number,
      required: true,
    },
    gameTab: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShowGame",
      required: true,
    },
    gameProvider: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    updatedBy: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    }
  },
  { timestamps: true }
);
gameSchema.index({ gameId: 1, gameTab: 1 }, { unique: true });
const Game = mongoose.model("Game", gameSchema);
export default Game;
