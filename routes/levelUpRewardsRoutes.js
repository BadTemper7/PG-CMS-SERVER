// routes/levelUpRewardsRoutes.js
import express from "express";
import {
  claimLevelReward,
  getLevelUpInfo,
  deleteLevelRewardByUsername,
} from "../controllers/levelUpRewardsController.js";

const router = express.Router();

// Public routes
router.post("/claim", claimLevelReward);
router.get("/info/:username", getLevelUpInfo);
router.delete("/:username", deleteLevelRewardByUsername);

export default router