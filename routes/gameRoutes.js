import express from "express";
import {
  createGame,
  getGames,
  getGameById,
  updateGame,
  deleteGame,
  deleteManyGames,
} from "../controllers/gameController.js";

const router = express.Router();

// Admin routes
router.post("/", createGame);
router.get("/", getGames);
router.get("/:id", getGameById);
router.put("/:id", updateGame);
router.delete("/:id", deleteGame);
router.post("/bulk-delete", deleteManyGames);

export default router;
