// routes/settingRoutes.js
import express from "express";
import {
  getAllSettings,
  getSettingByKey,
  updateSetting,
  updateSettings,
  getTurnoverValue,
  updateTurnoverValue,
  getPromoDates,
  updatePromoDates,
} from "../controllers/settingController.js";

const router = express.Router();

// Public routes
router.get("/turnover", getTurnoverValue); // This endpoint works
router.get("/promo-dates", getPromoDates);

// Protected/Admin routes
router.get("/", getAllSettings);
router.put("/turnover", updateTurnoverValue); // This endpoint works
router.put("/promo-dates", updatePromoDates);
router.get("/:key", getSettingByKey);
router.put("/", updateSettings);
router.put("/:key", updateSetting);

export default router;
