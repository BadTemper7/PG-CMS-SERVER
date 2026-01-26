import Outlet from "../models/Outlet.js";
import Terminal from "../models/Terminal.js";

export const createTerminal = async (req, res) => {
  try {
    const { outletId } = req.params;
    const { code, description, deviceKey, active = true } = req.body;

    if (!code || !deviceKey) {
      return res.status(400).json({ error: "code and deviceKey are required" });
    }

    const outlet = await Outlet.findById(outletId).lean();
    if (!outlet) return res.status(404).json({ error: "Outlet not found" });

    const existsKey = await Terminal.findOne({ deviceKey }).lean();
    if (existsKey)
      return res.status(409).json({ error: "deviceKey already exists" });

    const terminal = await Terminal.create({
      outletId,
      code,
      description,
      deviceKey,
      active: !!active,
    });

    return res.json(terminal);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const listTerminals = async (req, res) => {
  try {
    const filter = {};
    if (req.query.outletId) filter.outletId = req.query.outletId;
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const rows = await Terminal.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const getTerminal = async (req, res) => {
  try {
    const row = await Terminal.findById(req.params.terminalId).lean();
    if (!row) return res.status(404).json({ error: "Terminal not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const updateTerminal = async (req, res) => {
  try {
    const row = await Terminal.findByIdAndUpdate(
      req.params.terminalId,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!row) return res.status(404).json({ error: "Terminal not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export const removeTerminal = async (req, res) => {
  try {
    const row = await Terminal.findByIdAndDelete(req.params.terminalId).lean();
    if (!row) return res.status(404).json({ error: "Terminal not found" });
    return res.json({ message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
