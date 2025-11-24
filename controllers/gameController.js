import Game from "../models/Game.js";
import { broadcast } from "../wsServer.js";

// Create a new game
export const createGame = async (req, res) => {
  try {
    const { gameId, gameName, gameImg, gameDemo, gameCategory, gameTab } =
      req.body;

    // Validate required fields
    if (!gameId || !gameName || !gameImg || gameCategory === undefined) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const game = new Game({
      gameId,
      gameName,
      gameImg,
      gameDemo,
      gameCategory,
      gameTab,
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

// Get all games (optionally filter by category or tab)
export const getGames = async (req, res) => {
  try {
    const { category, tab } = req.query;

    const filter = {};
    if (category !== undefined) filter.gameCategory = Number(category);
    if (tab !== undefined) filter.gameTab = tab;

    const games = await Game.find(filter).sort({ gameId: 1 });

    res.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get single game by ID
export const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.json(game);
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Game not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update a game
export const updateGame = async (req, res) => {
  try {
    const updateData = {};

    [
      "gameId",
      "gameName",
      "gameImg",
      "gameDemo",
      "gameCategory",
      "gameTab",
    ].forEach((field) => {
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

// Delete a game
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

// Bulk delete games
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
  } catch (err) {
    console.error("Bulk delete game error:", err);
    res.status(500).json({ message: "Bulk game delete failed" });
  }
};

// Sample test endpoint
export const getSampleGameResult = (req, res) => {
  res.send("Game route working correctly");
};
