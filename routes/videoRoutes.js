import express from "express";
import multer from "multer";
import {
  createVideo,
  listVideos,
  getVideo,
  updateVideo,
  removeVideo,
  getOutletsForVideo,
} from "../controllers/videoController.js";

const router = express.Router();

const upload = multer({ dest: "tmp_uploads/" });

router.get("/", listVideos);
router.get("/:videoId/outlets", getOutletsForVideo);
router.post("/", upload.single("file"), createVideo);
router.get("/:videoId", getVideo);
router.put("/:videoId", updateVideo);
router.delete("/:videoId", removeVideo);

export default router;
