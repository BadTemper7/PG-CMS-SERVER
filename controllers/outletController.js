import Outlet from "../models/Outlet.js";

export const createOutlet = async (req, res) => {
  try {
    const { code, name, location, siteValue, active = true } = req.body;

    if (!code || !name || !siteValue) {
      return res
        .status(400)
        .json({ error: "code, name, and siteValue are required" });
    }

    const exists = await Outlet.findOne({ code }).lean();
    if (exists) {
      return res.status(409).json({ error: "Outlet code already exists" });
    }

    const outlet = await Outlet.create({
      code,
      name,
      location,
      siteValue,
      active: !!active,
    });

    return res.json(outlet);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const listOutlets = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;
    if (req.query.siteValue) filter.siteValue = req.query.siteValue;

    const rows = await Outlet.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const getOutlet = async (req, res) => {
  try {
    const row = await Outlet.findById(req.params.outletId).lean();
    if (!row) return res.status(404).json({ error: "Outlet not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const updateOutlet = async (req, res) => {
  try {
    const row = await Outlet.findByIdAndUpdate(req.params.outletId, req.body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!row) return res.status(404).json({ error: "Outlet not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const removeOutlet = async (req, res) => {
  try {
    const row = await Outlet.findByIdAndDelete(req.params.outletId).lean();
    if (!row) return res.status(404).json({ error: "Outlet not found" });
    return res.json({ message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
