import ShowGame from "../models/ShowGame.js";
import { broadcast } from "../wsServer.js";

// CREATE SHOW GAME
export const createShowGame = async (req, res) => {
  try {
    const { showNumber, gameTab } = req.body;

    // Validate required fields
    if (showNumber === undefined || gameTab === undefined) {
      return res.status(400).json({
        error: "Required fields are missing",
      });
    }

    const showGame = new ShowGame({
      showNumber,
      gameTab,
    });

    const savedShowGame = await showGame.save();

    broadcast({
      type: "SHOWGAME_UPDATED",
      action: "create",
      showGame: savedShowGame,
    });

    res.status(201).json({
      message: "ShowGame created successfully",
      showGame: savedShowGame,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL SHOW GAMES (with optional filters)
export const getShowGames = async (req, res) => {
  try {
    const { gameTab } = req.query;

    const filter = {};

    if (gameTab) filter.gameTab = gameTab;

    const showGames = await ShowGame.find(filter).sort({ showNumber: 1 });

    return res.json(showGames);
  } catch (error) {
    console.error("Error fetching show games:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// GET SHOW GAME BY showNumber
export const getShowGameById = async (req, res) => {
  try {
    const showNumber = req.params.id;
    const showGame = await ShowGame.findOne({ showNumber });

    if (!showGame) {
      return res.status(404).json({ error: "ShowGame not found" });
    }

    res.json({ showGame, exists: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE SHOW GAME BY showNumber
export const updateShowGame = async (req, res) => {
  try {
    const allowedFields = ["showNumber", "gameTab"];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const showGame = await ShowGame.findOneAndUpdate(
      { showNumber: req.params.id },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!showGame) {
      return res.status(404).json({ error: "ShowGame not found" });
    }

    broadcast({
      type: "SHOWGAME_UPDATED",
      action: "update",
      showGame,
    });

    res.json({
      message: "ShowGame updated successfully",
      showGame,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE SHOW GAME
export const deleteShowGame = async (req, res) => {
  try {
    const showGame = await ShowGame.findOneAndDelete({
      showNumber: req.params.id,
    });

    if (!showGame) {
      return res.status(404).json({ error: "ShowGame not found" });
    }

    broadcast({
      type: "SHOWGAME_UPDATED",
      action: "delete",
      showGame,
    });

    res.json({ message: "ShowGame deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// BULK DELETE SHOW GAMES
export const deleteManyShowGames = async (req, res) => {
  try {
    const { showNumbers } = req.body;

    if (
      !showNumbers ||
      !Array.isArray(showNumbers) ||
      showNumbers.length === 0
    ) {
      return res.status(400).json({ message: "No show numbers provided" });
    }

    const result = await ShowGame.deleteMany({
      showNumber: { $in: showNumbers },
    });

    broadcast({
      type: "SHOWGAME_UPDATED",
      action: "delete",
    });

    res.json({
      message: `${result.deletedCount} ShowGames deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk delete ShowGame error:", error);
    res.status(500).json({ message: "Bulk ShowGame delete failed" });
  }
};

// SAMPLE ENDPOINT
export const getSampleShowGameResult = (req, res) => {
  res.send("ShowGame route working correctly");
};
