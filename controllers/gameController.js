import Game from "../models/Game.js";
import { broadcast } from "../wsServer.js";

//
// CREATE GAME
//
export const createGame = async (req, res) => {
  try {
    const {
      gameId,
      gameName,
      gameImg,
      gameDemo,
      gameCategory,
      gameTab,
      gameProvider,
    } = req.body;

    // Validate required fields
    if (!gameId || !gameName || !gameImg || !gameCategory || !gameProvider) {
      return res.status(400).json({
        error: "Required fields are missing",
      });
    }

    // Prevent duplicate gameId
    const exists = await Game.findOne({ gameId });
    if (exists) {
      return res.status(400).json({ error: "gameId already exists" });
    }

    const game = new Game({
      gameId,
      gameName,
      gameImg,
      gameDemo,
      gameCategory,
      gameTab,
      gameProvider,
    });

    const savedGame = await game.save();

    broadcast({
      type: "GAME_UPDATED",
      action: "create",
      game: savedGame,
    });

    res.status(201).json({
      message: "Game created successfully",
      game: savedGame,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//
// GET ALL GAMES (with optional filters)
//
export const getGames = async (req, res) => {
  try {
    const { category, tab, provider } = req.query;

    const filter = {};

    if (category) filter.gameCategory = Number(category);
    if (tab) filter.gameTab = tab;
    if (provider) filter.gameProvider = provider; // 👈 Fetch only this provider

    const games = await Game.find(filter).sort({ gameId: 1 });

    return res.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: "Server error" });
  }
};

//
// GET GAME BY gameId
//
export const getGameById = async (req, res) => {
  try {
    const gameId = req.params.id;
    const game = await Game.findOne({ gameId: gameId });

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }
    res.json({ game, exists: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//
// UPDATE GAME BY MONGO _id
//
export const updateGame = async (req, res) => {
  try {
    const allowedFields = [
      "gameId",
      "gameName",
      "gameImg",
      "gameDemo",
      "gameCategory",
      "gameTab",
      "gameProvider",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const game = await Game.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    broadcast({
      type: "GAME_UPDATED",
      action: "update",
      game,
    });

    res.json({
      message: "Game updated successfully",
      game,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//
// DELETE GAME
//
export const deleteGame = async (req, res) => {
  try {
    const game = await Game.findByIdAndDelete(req.params.id);

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    broadcast({
      type: "GAME_UPDATED",
      action: "delete",
      game,
    });

    res.json({ message: "Game deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//
// BULK DELETE
//
export const deleteManyGames = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const result = await Game.deleteMany({ _id: { $in: ids } });

    broadcast({
      type: "GAME_UPDATED",
      action: "delete",
    });

    res.json({
      message: `${result.deletedCount} games deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk delete game error:", error);
    res.status(500).json({ message: "Bulk game delete failed" });
  }
};

//
// SAMPLE ENDPOINT
//
export const getSampleGameResult = (req, res) => {
  res.send("Game route working correctly");
};
