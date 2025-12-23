import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  uploadMedia,
  listMedia,
  setMediaActive,
  deleteMedia, // ✅ add
  uploadMiddleware,
} from "../controllers/mediaController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage });

router.post("/upload", uploadMiddleware, uploadMedia);
router.post("/upload", upload.single("file"), uploadMedia);
router.get("/", listMedia);
router.patch("/:id/active", setMediaActive);

// ✅ remove media (DB + file on disk + device mappings)
router.delete("/:id", deleteMedia);

export default router;
