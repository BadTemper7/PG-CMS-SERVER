import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";

// CREATE USER
export const createUser = async (req, res) => {
  try {
    const { username, password, roles } = req.body;

    if (!username || !password || !roles) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const user = await User.create({ username, password, roles });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        username: user.username,
        roles: user.roles,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// LOGIN USER
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid password" });

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, username: user.username, roles: user.roles },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET ALL USERS
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET SINGLE USER
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE USER (Superadmin only)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE MANY USERS
export const deleteManyUsers = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    // Optional safety: prevent deleting super admin
    // const protectedIds = ["12345SUPERADMINID"];
    // ids = ids.filter(id => !protectedIds.includes(id));

    const result = await User.deleteMany({ _id: { $in: ids } });

    return res.json({
      message: `${result.deletedCount} users deleted successfully`,
    });
  } catch (err) {
    console.error("Bulk delete user error:", err);
    return res.status(500).json({ message: "Bulk user delete failed" });
  }
};
