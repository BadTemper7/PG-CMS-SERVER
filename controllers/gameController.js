import Game from "../models/Game.js";
import ShowGame from "../models/ShowGame.js"; // Assuming the path to the ShowGame model
import { broadcast } from "../wsServer.js";

//
// CREATE GAME
//

import mongoose from "mongoose";

export const syncTopGames = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const gamesData = req.body;

    if (!Array.isArray(gamesData) || gamesData.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Request must contain an array of games" });
    }

    // Validate + normalize + enforce single tab (so sync deletes don't nuke other tabs)
    const required = [
      "gameId",
      "gameName",
      "gameImg",
      "gameCategory",
      "gameProvider",
      "gameTab",
    ];
    const seen = new Set();

    let tabId = null;

    const incoming = gamesData.map((g, idx) => {
      const missing = required.filter((k) => !g?.[k]);
      if (missing.length) {
        throw Object.assign(new Error("VALIDATION_ERROR"), {
          status: 400,
          details: { index: idx, missing, received: g },
        });
      }

      if (seen.has(g.gameId)) {
        throw Object.assign(new Error("DUPLICATE_GAMEID"), {
          status: 400,
          details: { index: idx, gameId: g.gameId },
        });
      }
      seen.add(g.gameId);

      if (!tabId) tabId = String(g.gameTab);
      if (String(g.gameTab) !== tabId) {
        throw Object.assign(new Error("MULTIPLE_TABS"), {
          status: 400,
          details: {
            message:
              "All games in req.body must share the same gameTab for sync",
          },
        });
      }

      return {
        gameId: g.gameId,
        gameName: g.gameName,
        gameImg: g.gameImg,
        gameDemo: g.gameDemo,
        gameCategory: g.gameCategory,
        gameTab: g.gameTab,
        gameProvider: g.gameProvider,
        order: idx + 1, // req.body is the truth
        updatedBy: "system",
      };
    });

    // Validate ShowGame tab exists
    const showGame = await ShowGame.findById(tabId).session(session);
    if (!showGame) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Invalid gameTab ID" });
    }

    const baseFilter = { updatedBy: "system", gameTab: tabId };

    const existingSystemGames = await Game.find(baseFilter)
      .select("gameId")
      .lean()
      .session(session);

    // If no system games yet => insert all
    if (existingSystemGames.length === 0) {
      const inserted = await Game.insertMany(incoming, { session });

      await session.commitTransaction();
      session.endSession();

      inserted.forEach((game) =>
        broadcast({ type: "GAME_UPDATED", action: "create", game })
      );

      return res.status(201).json({
        message: `Inserted ${inserted.length} system games for tab=${tabId}`,
        games: inserted,
      });
    }

    // Otherwise: Sync discrepancies
    const existingIds = new Set(existingSystemGames.map((g) => g.gameId));
    const incomingIds = new Set(incoming.map((g) => g.gameId));

    // delete DB games not present in req.body
    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));

    let deletedDocs = [];
    if (idsToDelete.length) {
      deletedDocs = await Game.find({
        ...baseFilter,
        gameId: { $in: idsToDelete },
      })
        .lean()
        .session(session);

      await Game.deleteMany({
        ...baseFilter,
        gameId: { $in: idsToDelete },
      }).session(session);
    }

    // upsert all incoming (updates existing + inserts missing)
    await Game.bulkWrite(
      incoming.map((g) => ({
        updateOne: {
          filter: { ...baseFilter, gameId: g.gameId },
          update: { $set: g },
          upsert: true,
        },
      })),
      { session }
    );

    const synced = await Game.find(baseFilter)
      .sort({ order: 1 })
      .lean()
      .session(session);

    await session.commitTransaction();
    session.endSession();

    // Broadcast changes
    deletedDocs.forEach((game) =>
      broadcast({ type: "GAME_UPDATED", action: "delete", game })
    );
    synced.forEach((game) =>
      broadcast({ type: "GAME_UPDATED", action: "sync", game })
    );

    return res.status(200).json({
      message: `Synced tab=${tabId}. Deleted extras: ${idsToDelete.length}. Current: ${synced.length}.`,
      deleted: idsToDelete,
      games: synced,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error.status === 400 && error.message === "VALIDATION_ERROR") {
      return res.status(400).json({
        error: "Required fields are missing for one of the games",
        ...error.details,
      });
    }
    if (error.status === 400 && error.message === "DUPLICATE_GAMEID") {
      return res
        .status(400)
        .json({ error: "Duplicate gameId in request body", ...error.details });
    }
    if (error.status === 400 && error.message === "MULTIPLE_TABS") {
      return res.status(400).json({ error: error.details.message });
    }

    return res.status(500).json({ error: error.message });
  }
};

export const updateGameOrder = async (req, res) => {
  try {
    const gameOrders = req.body; // [{ _id, order, gameName? }, ...]

    if (!Array.isArray(gameOrders) || gameOrders.length === 0) {
      return res
        .status(400)
        .json({ error: "gameOrders must be a non-empty array" });
    }

    // Basic payload validation
    for (const g of gameOrders) {
      if (!g?._id || typeof g.order !== "number") {
        return res
          .status(400)
          .json({ error: "Each item must contain {_id, order:number}" });
      }
    }

    // Optional: ensure there are no duplicate orders in the update set
    const orders = gameOrders.map((g) => g.order);
    if (new Set(orders).size !== orders.length) {
      return res
        .status(400)
        .json({ error: "Duplicate 'order' values in payload" });
    }

    // Bulk update (fast + safe)
    const ops = gameOrders.map((g) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(g._id) },
        update: { $set: { order: g.order } },
      },
    }));

    const bulkResult = await Game.bulkWrite(ops, { ordered: true });

    // Fetch updated docs to return/broadcast (keeps response consistent)
    const ids = gameOrders.map((g) => g._id);
    const updatedGames = await Game.find({ _id: { $in: ids } }).lean();

    // broadcast to clients (if you have this wired)
    // broadcast({
    //   type: "GAME_UPDATED",
    //   action: "order-reorder",
    //   games: updatedGames,
    // });

    return res.json({
      message: "Order updated successfully",
      updated: true,
      modifiedCount:
        bulkResult.modifiedCount ?? bulkResult.nModified ?? undefined,
      games: updatedGames,
    });
  } catch (error) {
    console.error("Update order failed:", error);
    return res.status(500).json({ error: "Failed to arrange order" });
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
      updatedBy,
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
      updatedBy,
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
