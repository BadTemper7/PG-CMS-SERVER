import express from "express";
import multer from "multer";
import path from "path";
import { uploadMedia, listMedia } from "../controllers/mediaController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage });

router.post("/upload", upload.single("file"), uploadMedia);
router.get("/", listMedia);

export default router;
