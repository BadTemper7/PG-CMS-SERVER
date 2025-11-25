import express from "express";
import {
  createShowGame,
  getShowGames,
  getShowGameById,
  updateShowGame,
  deleteShowGame,
  deleteManyShowGames,
} from "../controllers/showGameController.js";

const router = express.Router();

// Admin routes for ShowGame
router.post("/", createShowGame);
router.get("/", getShowGames);
router.get("/:id", getShowGameById);
router.put("/:id", updateShowGame);
router.delete("/:id", deleteShowGame);
router.post("/bulk-delete", deleteManyShowGames);

export default router;
