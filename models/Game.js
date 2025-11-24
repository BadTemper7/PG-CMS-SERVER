import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    gameId: {
      type: Number,
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
  },
  { timestamps: true }
);
const Game = mongoose.model("Game", gameSchema);
export default Game;
