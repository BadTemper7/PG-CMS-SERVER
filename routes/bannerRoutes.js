import express from "express";
import {
  createBanner,
  getAllBanners,
  updateStatus,
  deleteBanner,
  deleteManyBanners,
} from "../controllers/bannerController.js";
const router = express.Router();

router.post("/", createBanner);
router.get("/", getAllBanners);
router.put("/:id", updateStatus);
router.delete("/:id", deleteBanner);
router.post("/bulk-delete", deleteManyBanners);

export default router;
