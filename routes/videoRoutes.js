import express from "express";
import {
  getVideos,
  getVideo,
  uploadVideo,
  updateVideo,
  setVideoActive,
  deleteVideo,
  testCloudinaryConnection,
  uploadMiddleware,
} from "../controllers/videoController.js";

const router = express.Router();

// Test endpoint
router.get("/cloudinary/test", testCloudinaryConnection);

// Upload endpoint
router.post("/upload", uploadMiddleware, uploadVideo);

// Other endpoints
router.get("/", getVideos);
router.get("/:id", getVideo);
router.put("/:id", updateVideo);
router.patch("/:id/active", setVideoActive);
router.delete("/:id", deleteVideo);

export default router;
