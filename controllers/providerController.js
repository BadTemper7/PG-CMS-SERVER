import Provider from "../models/Provider.js";
import { broadcast } from "../wsServer.js";

// Create a new provider
export const createProvider = async (req, res) => {
  try {
    const {
      provider_id,
      name,
      directory,
      darkLogo,
      lightLogo,
      image,
      newGame = false,
      topGame = false,
      hidden = false,
      order = -1,
    } = req.body;

    // Required fields validation
    if (!provider_id || !name || !directory || !image) {
      return res.status(400).json({
        error: "provider_id, name, directory, and image are required",
      });
    }

    const provider = new Provider({
      provider_id,
      name,
      directory,
      darkLogo,
      lightLogo,
      image,
      newGame,
      topGame,
      hidden,
      order,
    });

    const savedProvider = await provider.save();
    broadcast({
      type: "PROVIDER_UPDATED",
      action: "create",
      savedProvider,
    });
    res.status(201).json({
      message: "Provider created successfully",
      provider: savedProvider,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all providers with optional filtering
export const getProviders = async (req, res) => {
  try {
    const { hidden, newGame, topGame } = req.query;
    let filter = {};

    if (hidden !== undefined) filter.hidden = hidden === "true";
    if (newGame !== undefined) filter.newGame = newGame === "true";
    if (topGame !== undefined) filter.topGame = topGame === "true";

    const providers = await Provider.find(filter).sort({
      order: 1,
      createdAt: -1,
    });

    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get a single provider by ID
export const getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    res.json(provider);
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update provider
export const updateProvider = async (req, res) => {
  try {
    const updateData = req.body;

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    broadcast({
      type: "PROVIDER_UPDATED",
      action: "update",
      provider,
    });
    res.json({
      message: "Provider updated successfully",
      provider,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Delete provider
export const deleteProvider = async (req, res) => {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    broadcast({
      type: "PROVIDER_UPDATED",
      action: "delete",
      provider,
    });
    res.json({ message: "Provider deleted successfully" });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Bulk delete providers
export const deleteManyProviders = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const result = await Provider.deleteMany({ _id: { $in: ids } });
    broadcast({
      type: "PROVIDER_UPDATED",
      action: "delete",
      result,
    });
    res.json({
      message: `${result.deletedCount} providers deleted successfully`,
    });
  } catch (err) {
    console.error("Bulk delete providers error:", err);
    res.status(500).json({ message: "Bulk provider delete failed" });
  }
};

// Update hidden visibility
export const updateProviderVisibility = async (req, res) => {
  try {
    const { hidden } = req.body;

    if (hidden === undefined) {
      return res.status(400).json({ error: "Hidden value is required" });
    }

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { hidden },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    broadcast({
      type: "PROVIDER_UPDATED",
      action: "update",
      provider,
    });
    res.json({
      message: "Provider visibility updated successfully",
      provider,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Test route
export const getSampleResult = (req, res) => {
  res.send("Providers API working properly");
};

// Bulk create providers
export const bulkCreateProviders = async (req, res) => {
  try {
    const providers = req.body;

    if (!Array.isArray(providers) || providers.length === 0) {
      return res
        .status(400)
        .json({ error: "A non-empty providers array is required" });
    }

    // Validate each provider
    for (const p of providers) {
      if (!p.provider_id || !p.name || !p.directory || !p.image) {
        return res.status(400).json({
          error:
            "Each provider must include provider_id, name, directory, and image",
          invalid_entry: p,
        });
      }
    }

    const result = await Provider.insertMany(providers, { ordered: false });

    res.status(201).json({
      message: `${result.length} providers inserted successfully`,
      providers: result,
    });
  } catch (error) {
    console.error("Bulk insert error:", error);
    res.status(500).json({ error: error.message });
  }
};
