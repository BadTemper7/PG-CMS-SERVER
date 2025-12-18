import express from "express";
import {
  createPlaylist,
  listPlaylists,
  updatePlaylist,
} from "../controllers/playlistController.js";

const router = express.Router();

router.post("/", createPlaylist);
router.get("/", listPlaylists);
router.put("/:id", updatePlaylist);

export default router;
