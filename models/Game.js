import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true,
      unique: true,
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
      type: String,
      default: "",
    },
    gameProvider: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
const Game = mongoose.model("Game", gameSchema);
export default Game;
