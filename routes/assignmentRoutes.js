import express from "express";
import { assignPlaylistToDevice } from "../controllers/assignmentController.js";

const router = express.Router();
router.post("/", assignPlaylistToDevice);

export default router;
