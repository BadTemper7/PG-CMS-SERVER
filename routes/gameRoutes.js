import express from "express";
import {
  createGame,
  getGames,
  getGameById,
  updateGame,
  deleteGame,
  deleteManyGames,
  createTopGames,
  updateGameOrder,
} from "../controllers/gameController.js";

const router = express.Router();

// Admin routes
router.post("/", createGame);
router.get("/", getGames);
router.put("/reorder", updateGameOrder);
router.post("/bulk-insert", createTopGames);
router.post("/bulk-delete", deleteManyGames);

router.get("/:id", getGameById);
router.put("/:id", updateGame);
router.delete("/:id", deleteGame);

// router.post("/reorder", updateTopGameOrder);
export default router;
