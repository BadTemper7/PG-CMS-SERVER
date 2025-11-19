import express from "express";
import {
  createBanner,
  getAllBanners,
  updateBanner,
  deleteBanner,
  deleteManyBanners,
  updateBannerStatus
} from "../controllers/bannerController.js";
const router = express.Router();

router.post("/", createBanner);
router.get("/", getAllBanners);
router.put("/:id", updateBanner);
router.patch("/:id/status", updateBannerStatus);
router.delete("/:id", deleteBanner);
router.post("/bulk-delete", deleteManyBanners);

export default router;
