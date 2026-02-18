// controllers/settingController.js
import Setting from "../models/Settings.js";

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private/Admin
export const getAllSettings = async (req, res) => {
  try {
    const settings = await Setting.find({}).sort({ category: 1, order: 1 });

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error in getAllSettings:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get setting by key
// @route   GET /api/settings/:key
// @access  Private/Admin
export const getSettingByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await Setting.findOne({ key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting "${key}" not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (error) {
    console.error("Error in getSettingByKey:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update setting
// @route   PUT /api/settings/:key
// @access  Private/Admin
export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, lastModifiedBy } = req.body;

    const setting = await Setting.findOneAndUpdate(
      { key },
      {
        value,
        lastModifiedBy,
        updatedAt: Date.now(),
      },
      { new: true },
    );

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting "${key}" not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Setting updated successfully",
      data: setting,
    });
  } catch (error) {
    console.error("Error in updateSetting:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update multiple settings
// @route   PUT /api/settings
// @access  Private/Admin
export const updateSettings = async (req, res) => {
  try {
    const { updates, userId } = req.body;

    const results = await Setting.updateSettings(updates, userId);

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: results,
    });
  } catch (error) {
    console.error("Error in updateSettings:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get turnover value
// @route   GET /api/settings/turnover
// @access  Public
export const getTurnoverValue = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: "turnover_value" });

    return res.status(200).json({
      success: true,
      data: {
        turnoverAmount: setting ? setting.value : 0,
        lastUpdated: setting ? setting.updatedAt : null,
      },
    });
  } catch (error) {
    console.error("Error in getTurnoverValue:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update turnover value
// @route   PUT /api/settings/turnover
// @access  Private/Admin
export const updateTurnoverValue = async (req, res) => {
  try {
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        message: "Value is required",
      });
    }

    const amount = Number(value);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Value must be a valid positive number",
      });
    }

    // First check if the setting exists
    let setting = await Setting.findOne({ key: "turnover_value" });

    if (setting) {
      // Update existing setting
      setting.value = amount;
      setting.updatedAt = Date.now();
      await setting.save();

      console.log("Updated existing setting:", setting);
    } else {
      // Create new setting with ALL required fields
      setting = new Setting({
        settingType: "system",
        key: "turnover_value",
        value: amount,
        label: "Turnover Value",
        description: "Current turnover value for testing purposes",
        dataType: "number",
        isEditable: true,
        category: "general",
        order: 1,
        // Add any other required fields from your schema
      });
      await setting.save();

      console.log("Created new setting:", setting);
    }

    return res.status(200).json({
      success: true,
      message: "Turnover value updated successfully",
      data: {
        turnoverAmount: setting.value,
        lastUpdated: setting.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error in updateTurnoverValue:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get promo dates
// @route   GET /api/settings/promo-dates
// @access  Public
export const getPromoDates = async (req, res) => {
  try {
    const startSetting = await Setting.findOne({ key: "promo_start_date" });
    const endSetting = await Setting.findOne({ key: "promo_end_date" });

    return res.status(200).json({
      success: true,
      data: {
        startDate: startSetting ? startSetting.value : "2026-03-02",
        endDate: endSetting ? endSetting.value : "2026-03-29",
      },
    });
  } catch (error) {
    console.error("Error in getPromoDates:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update promo dates
// @route   PUT /api/settings/promo-dates
// @access  Private/Admin
export const updatePromoDates = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const updates = {};
    if (startDate) updates.promo_start_date = startDate;
    if (endDate) updates.promo_end_date = endDate;

    const results = [];

    if (startDate) {
      const setting = await Setting.findOneAndUpdate(
        { key: "promo_start_date" },
        {
          value: startDate,
          updatedAt: Date.now(),
        },
        { upsert: true, new: true },
      );
      results.push(setting);
    }

    if (endDate) {
      const setting = await Setting.findOneAndUpdate(
        { key: "promo_end_date" },
        {
          value: endDate,
          updatedAt: Date.now(),
        },
        { upsert: true, new: true },
      );
      results.push(setting);
    }

    return res.status(200).json({
      success: true,
      message: "Promo dates updated successfully",
      data: results,
    });
  } catch (error) {
    console.error("Error in updatePromoDates:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
