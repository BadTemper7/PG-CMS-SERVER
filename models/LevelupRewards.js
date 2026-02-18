// models/levelUpRewardsModel.js
import mongoose from "mongoose";

const levelRewardSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isClaimed: {
      type: Boolean,
      default: false,
    },
    claimedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    claimedAt: {
      type: Date,
    },
    level: {
      type: Number,
      min: 1,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const LevelUpRewards = mongoose.model("LevelUpRewards", levelRewardSchema);
export default LevelUpRewards;
