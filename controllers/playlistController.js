import Playlist from "../models/Playlist.js";
import { broadcast } from "../wsServer.js";

export const createPlaylist = async (req, res) => {
  try {
    const { name, items = [] } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const playlist = await Playlist.create({ name, items });
    broadcast({ type: "PLAYLIST_UPDATED", action: "create", playlist });
    res.status(201).json({ message: "Playlist created", playlist });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const listPlaylists = async (req, res) => {
  const playlists = await Playlist.find().sort({ createdAt: -1 });
  res.json(playlists);
};

export const updatePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });

    broadcast({ type: "PLAYLIST_UPDATED", action: "update", playlist });
    res.json({ message: "Playlist updated", playlist });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
