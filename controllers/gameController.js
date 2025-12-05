import Game from "../models/Game.js";
import ShowGame from "../models/ShowGame.js"; // Assuming the path to the ShowGame model
import { broadcast } from "../wsServer.js";

//
// CREATE GAME
//

export const createTopGames = async (req, res) => {
  try {
    const gamesData = req.body; // Expecting an array of games in the request body

    // Validate that the request body is an array of games
    if (!Array.isArray(gamesData) || gamesData.length === 0) {
      return res.status(400).json({
        error: "Request must contain an array of games",
      });
    }

    // Loop through each game to validate and process
    const gamesToInsert = [];

    let order = 1;

    for (const gameData of gamesData) {
      const {
        gameId,
        gameName,
        gameImg,
        gameDemo,
        gameCategory,
        gameTab, // This is the ObjectId referring to the ShowGame collection
        gameProvider,
      } = gameData;

      // Validate required fields for each game
      if (
        !gameId ||
        !gameName ||
        !gameImg ||
        !gameCategory ||
        !gameProvider ||
        !gameTab
      ) {
        return res.status(400).json({
          error: "Required fields are missing for one of the games",
        });
      }

      // Prevent duplicate gameId
      const exists = await Game.findOne({ gameId });
      if (exists) {
        return res
          .status(400)
          .json({ error: `gameId ${gameId} already exists` });
      }

      // Look up the ShowGame to get gameTab info (either "top" or "hot")
      const showGame = await ShowGame.findById(gameTab);
      if (!showGame) {
        return res.status(400).json({ error: "Invalid gameTab ID" });
      }

      // Prepare the game data with the calculated order
      const game = {
        gameId,
        gameName,
        gameImg,
        gameDemo,
        gameCategory,
        gameTab, // This will be the ObjectId referencing ShowGame
        gameProvider,
        order, // Automatically set the order based on existing games in the same tab
      };

      gamesToInsert.push(game); // Add the game to the insert list
      order++;
    }

    // Insert all games at once
    const savedGames = await Game.insertMany(gamesToInsert);

    // Broadcast all game creations
    savedGames.forEach((game) => {
      broadcast({
        type: "GAME_UPDATED",
        action: "create",
        game,
      });
    });

    res.status(201).json({
      message: `${savedGames.length} games created successfully`,
      games: savedGames,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGameOrder = async (req, res) => {
  try {
    const { id1, id2 } = req.body;

    if (!id1 || !id2) {
      return res.status(400).json({ error: "id1 and id2 are required" });
    }
    if (id1 === id2) {
      return res.json({
        message: "IDs are identical. No switch performed.",
        updated: false,
      });
    }

    const g1 = await Game.findById(id1);
    const g2 = await Game.findById(id2);
    if (!g1 || !g2) {
      return res.status(404).json({ error: "One or both games not found" });
    }

    const order1 = g1.order;
    const order2 = g2.order;

    await Game.findByIdAndUpdate(id1, { order: order2 });
    await Game.findByIdAndUpdate(id2, { order: order1 });

    // ✅ populate so response shape matches GET /games
    const updated1 = await Game.findById(id1).populate("gameTab");
    const updated2 = await Game.findById(id2).populate("gameTab");

    broadcast({
      type: "GAME_UPDATED",
      action: "order-switch",
      games: [updated1, updated2],
    });

    return res.json({
      message: "Order switched successfully",
      updated: true,
      games: {
        [id1]: updated1,
        [id2]: updated2,
      },
    });
  } catch (error) {
    console.error("Switch order failed:", error);
    return res.status(500).json({ error: "Failed to switch game order" });
  }
};

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
    if (
      !gameId ||
      !gameName ||
      !gameImg ||
      !gameCategory ||
      !gameProvider ||
      !gameTab
    ) {
      return res.status(400).json({
        error: "Required fields are missing",
      });
    }

    // Prevent duplicate gameId
    const exists = await Game.findOne({ gameId, gameTab });
    if (exists) {
      return res.status(400).json({ error: "gameId already exists" });
    }

    // Get the current max order for the gameTab category
    let maxOrder = 0;
    const lastGame = await Game.findOne({ gameTab }).sort({ order: -1 }); // Sort by order descending
    if (lastGame) {
      maxOrder = lastGame.order; // Get the max order of the games within this gameTab
    }

    // Automatically set the order (increment from the last game order)
    const order = maxOrder + 1;

    const game = new Game({
      gameId,
      gameName,
      gameImg,
      gameDemo,
      gameCategory,
      gameTab, // Save the reference to ShowGame here
      gameProvider,
      order, // Automatically set order
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
    const { category, tab, provider, order } = req.query;
    console.log(provider);
    const filter = {};

    if (category) filter.gameCategory = Number(category);
    if (tab) filter.gameTab = tab;
    if (provider) filter.gameProvider = provider;
    if (order) filter.order = order; // Filter by game order (e.g., top or hot)
    const games = await Game.find(filter)
      .populate("gameTab") // Populate the ShowGame reference
      .sort({ order: 1 }); // Sort games by order field for priority

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
    const game = await Game.findOne({ gameId: gameId }).populate("gameTab");

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
      "order", // Including the order field for ranking
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
    }).populate("gameTab");

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
