// controllers/levelUpRewardsController.js
import LevelUpRewards from "../models/LevelupRewards.js";

// @desc    Claim level reward (one-time only)
// @route   POST /api/levelup-rewards/claim
// @access  Public
export const claimLevelReward = async (req, res) => {
  try {
    const { username, claimedAmount, level } = req.body;

    // Validation
    if (!username || !claimedAmount || !level) {
      return res.status(400).json({
        success: false,
        message: "Username, claimedAmount, and level are required",
      });
    }

    // Check if user already has a claim record
    let userClaim = await LevelUpRewards.findOne({ username });
    if (userClaim) {
      // User exists and has already claimed
      if (userClaim.isClaimed) {
        return res.status(403).json({
          success: false,
          message:
            "User has already claimed their rewards. No further claims allowed.",
          data: {
            username: userClaim.username,
            claimedAmount: userClaim.claimedAmount,
            claimedAt: userClaim.claimedAt,
            level: userClaim.level,
            isClaimed: true,
          },
        });
      }

      // User exists but hasn't claimed yet (shouldn't happen normally)
      userClaim.isClaimed = true;
      userClaim.claimedAmount = claimedAmount;
      userClaim.claimedAt = new Date();
      userClaim.level = level;
      await userClaim.save();
    } else {
      // First time user - create new claim record
      userClaim = new LevelUpRewards({
        username,
        isClaimed: true,
        claimedAmount,
        claimedAt: new Date(),
        level,
      });

      await userClaim.save();
    }

    return res.status(201).json({
      success: true,
      message: "Level reward claimed successfully",
      data: {
        username: userClaim.username,
        isClaimed: userClaim.isClaimed,
        claimedAmount: userClaim.claimedAmount,
        claimedAt: userClaim.claimedAt,
        level: userClaim.level,
      },
    });
  } catch (error) {
    console.error("Error in claimLevelReward:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate claim detected",
        error: "User already has a claim record",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get level up info by username
// @route   GET /api/levelup-rewards/info/:username
// @access  Public
export const getLevelUpInfo = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required",
      });
    }

    const userClaim = await LevelUpRewards.findOne({ username });

    if (!userClaim) {
      return res.status(200).json({
        success: true,
        data: {
          username,
          isClaimed: false,
          claimedAmount: 0,
          claimedAt: null,
          level: null,
          message: "User has not claimed any rewards yet",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        username: userClaim.username,
        isClaimed: userClaim.isClaimed,
        claimedAmount: userClaim.isClaimed ? userClaim.claimedAmount : 0,
        claimedAt: userClaim.isClaimed ? userClaim.claimedAt : null,
        level: userClaim.isClaimed ? userClaim.level : null,
      },
    });
  } catch (error) {
    console.error("Error in getLevelUpInfo:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const deleteLevelRewardByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required",
      });
    }

    // Find and delete the user's claim record
    const deletedClaim = await LevelUpRewards.findOneAndDelete({ username });

    if (!deletedClaim) {
      return res.status(404).json({
        success: false,
        message: `No claim record found for username: ${username}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Level reward record for ${username} deleted successfully`,
      data: {
        username: deletedClaim.username,
        isClaimed: deletedClaim.isClaimed,
        claimedAmount: deletedClaim.claimedAmount,
        claimedAt: deletedClaim.claimedAt,
        level: deletedClaim.level,
      },
    });
  } catch (error) {
    console.error("Error in deleteLevelRewardByUsername:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
