import OutletShema from "../models/Outlet.js";
const { Outlet, Terminal, PromotionAssignment, Video } = OutletShema;
// @desc    Create a new outlet
// @route   POST /api/outlets
// @access  Private/Admin
export const createOutlet = async (req, res) => {
  try {
    const { outletId, location, siteValue } = req.body;

    // Check if outlet already exists
    const existingOutlet = await Outlet.findOne({ outletId });
    if (existingOutlet) {
      return res.status(400).json({
        success: false,
        message: "Outlet with this ID already exists",
      });
    }

    // Create outlet
    const outlet = await Outlet.create({
      outletId,
      location,
      siteValue,
    });

    res.status(201).json({
      success: true,
      data: outlet,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error creating outlet",
    });
  }
};

// @desc    Get all outlets with statistics
// @route   GET /api/outlets
// @access  Private/Admin
export const getOutlets = async (req, res) => {
  try {
    const outlets = await Outlet.find().sort({ createdAt: -1 });

    // Get statistics for each outlet
    const outletsWithStats = await Promise.all(
      outlets.map(async (outlet) => {
        const terminals = await Terminal.find({ outletId: outlet._id });
        const assignments = await PromotionAssignment.find({
          outletId: outlet._id,
          isExpired: false,
        });

        const activeTerminals = terminals.filter(
          (t) => t.lastSeenAt && Date.now() - t.lastSeenAt < 5 * 60 * 1000, // Last 5 minutes
        );

        return {
          ...outlet.toObject(),
          stats: {
            totalTerminals: terminals.length,
            activeTerminals: activeTerminals.length,
            assignedVideos: assignments.length,
            gameUrl: outlet.gameUrl,
          },
        };
      }),
    );

    res.json({
      success: true,
      count: outlets.length,
      data: outletsWithStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching outlets",
    });
  }
};

// @desc    Get single outlet with detailed info
// @route   GET /api/outlets/:id
// @access  Private/Admin
export const getOutlet = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    // Get terminals for this outlet
    const terminals = await Terminal.find({ outletId: outlet._id }).sort({
      terminalNumber: 1,
    });

    // Get active video assignments
    const assignments = await PromotionAssignment.find({
      outletId: outlet._id,
      isExpired: false,
    })
      .populate("videoId")
      .sort({ createdAt: -1 });

    // Get videos assigned to this outlet
    const assignedVideos = assignments.map((assignment) => ({
      assignmentId: assignment._id,
      video: assignment.videoId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      isExpired: assignment.isExpired,
    }));

    // Get active terminals (last seen within 5 minutes)
    const activeTerminals = terminals.filter(
      (t) => t.lastSeenAt && Date.now() - t.lastSeenAt < 5 * 60 * 1000,
    );

    const response = {
      ...outlet.toObject(),
      terminals: {
        all: terminals,
        active: activeTerminals,
        count: terminals.length,
        activeCount: activeTerminals.length,
      },
      videos: {
        assigned: assignedVideos,
        count: assignedVideos.length,
      },
      stats: {
        onlinePercentage:
          terminals.length > 0
            ? Math.round((activeTerminals.length / terminals.length) * 100)
            : 0,
      },
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching outlet",
    });
  }
};

// @desc    Update outlet
// @route   PUT /api/outlets/:id
// @access  Private/Admin
export const updateOutlet = async (req, res) => {
  try {
    const { outletId, location, siteValue } = req.body;

    // Check if outletId is being changed and if it's already taken
    if (outletId) {
      const existingOutlet = await Outlet.findOne({
        outletId,
        _id: { $ne: req.params.id },
      });

      if (existingOutlet) {
        return res.status(400).json({
          success: false,
          message: "Outlet ID already taken by another outlet",
        });
      }
    }

    const outlet = await Outlet.findByIdAndUpdate(
      req.params.id,
      { outletId, location, siteValue },
      { new: true, runValidators: true },
    );

    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    res.json({
      success: true,
      data: outlet,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error updating outlet",
    });
  }
};

// @desc    Delete outlet and its dependencies
// @route   DELETE /api/outlets/:id
// @access  Private/Admin
export const deleteOutlet = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    // Check if outlet has terminals
    const terminals = await Terminal.find({ outletId: outlet._id });
    if (terminals.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete outlet with active terminals. Delete terminals first.",
      });
    }

    // Delete all promotion assignments for this outlet
    await PromotionAssignment.deleteMany({ outletId: outlet._id });

    // Delete the outlet
    await outlet.deleteOne();

    res.json({
      success: true,
      message: "Outlet deleted successfully",
      data: {
        deletedAssignments: true,
        deletedOutlet: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting outlet",
    });
  }
};

// @desc    Get outlet terminals
// @route   GET /api/outlets/:id/terminals
// @access  Private/Admin
export const getOutletTerminals = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    const terminals = await Terminal.find({ outletId: outlet._id }).sort({
      terminalNumber: 1,
    });

    // Calculate online status
    const terminalsWithStatus = terminals.map((terminal) => {
      const terminalObj = terminal.toObject();
      const isOnline =
        terminal.lastSeenAt && Date.now() - terminal.lastSeenAt < 5 * 60 * 1000;

      return {
        ...terminalObj,
        isOnline,
        status: isOnline ? "online" : "offline",
        lastSeenMinutes: terminal.lastSeenAt
          ? Math.round((Date.now() - terminal.lastSeenAt) / 60000)
          : null,
      };
    });

    res.json({
      success: true,
      data: {
        outlet: {
          _id: outlet._id,
          outletId: outlet.outletId,
          location: outlet.location,
        },
        terminals: terminalsWithStatus,
        count: terminals.length,
        onlineCount: terminalsWithStatus.filter((t) => t.isOnline).length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching outlet terminals",
    });
  }
};

// @desc    Get outlet videos (assigned promotions)
// @route   GET /api/outlets/:id/videos
// @access  Private/Admin
export const getOutletVideos = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    const assignments = await PromotionAssignment.find({
      outletId: outlet._id,
    })
      .populate("videoId")
      .sort({ createdAt: -1 });

    const videos = assignments.map((assignment) => ({
      assignmentId: assignment._id,
      video: assignment.videoId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      isExpired: assignment.isExpired,
      isActive: assignment.videoId?.isActive,
    }));

    res.json({
      success: true,
      data: {
        outlet: {
          _id: outlet._id,
          outletId: outlet.outletId,
          location: outlet.location,
        },
        videos,
        count: videos.length,
        activeCount: videos.filter((v) => !v.isExpired && v.isActive).length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching outlet videos",
    });
  }
};

// @desc    Assign video to outlet
// @route   POST /api/outlets/:id/assign-video
// @access  Private/Admin
export const assignVideoToOutlet = async (req, res) => {
  try {
    const { videoId, startDate, endDate } = req.body;
    const outletId = req.params.id;

    // Check if outlet exists
    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    // Check if video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Check if video is already assigned to this outlet
    const existingAssignment = await PromotionAssignment.findOne({
      outletId,
      videoId,
      isExpired: false,
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: "Video is already assigned to this outlet",
      });
    }

    // Create assignment
    const assignment = await PromotionAssignment.create({
      outletId,
      videoId,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    const populatedAssignment = await PromotionAssignment.findById(
      assignment._id,
    )
      .populate("videoId")
      .populate("outletId");

    res.status(201).json({
      success: true,
      data: populatedAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error assigning video to outlet",
    });
  }
};

// @desc    Remove video assignment from outlet
// @route   DELETE /api/outlets/:outletId/videos/:assignmentId
// @access  Private/Admin
export const removeVideoAssignment = async (req, res) => {
  try {
    const { outletId, assignmentId } = req.params;

    // Check if outlet exists
    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    // Find and delete assignment
    const assignment = await PromotionAssignment.findOneAndDelete({
      _id: assignmentId,
      outletId,
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Video assignment not found for this outlet",
      });
    }

    res.json({
      success: true,
      message: "Video assignment removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error removing video assignment",
    });
  }
};

// @desc    Get outlet dashboard statistics
// @route   GET /api/outlets/:id/dashboard
// @access  Private/Admin
export const getOutletDashboard = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: "Outlet not found",
      });
    }

    // Get all terminals for this outlet
    const terminals = await Terminal.find({ outletId: outlet._id });

    // Get active video assignments
    const assignments = await PromotionAssignment.find({
      outletId: outlet._id,
      isExpired: false,
    }).populate("videoId");

    // Calculate online terminals (last seen within 5 minutes)
    const onlineTerminals = terminals.filter(
      (t) => t.lastSeenAt && Date.now() - t.lastSeenAt < 5 * 60 * 1000,
    );

    // Calculate terminal status breakdown
    const terminalStatus = {
      online: onlineTerminals.length,
      offline: terminals.length - onlineTerminals.length,
      playing: terminals.filter((t) => t.lastState === "playing").length,
    };

    // Get recent activity (terminals seen in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTerminals = terminals.filter(
      (t) => t.lastSeenAt && t.lastSeenAt > oneDayAgo,
    );

    // Get videos by status
    const videos = assignments.map((a) => a.videoId);
    const activeVideos = videos.filter((v) => v && v.isActive);
    const inactiveVideos = videos.filter((v) => v && !v.isActive);

    const dashboardData = {
      outlet: {
        _id: outlet._id,
        outletId: outlet.outletId,
        location: outlet.location,
        siteValue: outlet.siteValue,
        gameUrl: outlet.gameUrl,
        createdAt: outlet.createdAt,
      },
      statistics: {
        terminals: {
          total: terminals.length,
          ...terminalStatus,
          onlinePercentage:
            terminals.length > 0
              ? Math.round((onlineTerminals.length / terminals.length) * 100)
              : 0,
          recentActivity: recentTerminals.length,
        },
        videos: {
          total: videos.length,
          active: activeVideos.length,
          inactive: inactiveVideos.length,
        },
        assignments: {
          total: assignments.length,
          active: assignments.filter((a) => !a.isExpired).length,
          expired: assignments.filter((a) => a.isExpired).length,
        },
      },
      recentTerminals: recentTerminals
        .map((t) => ({
          terminalNumber: t.terminalNumber,
          lastSeenAt: t.lastSeenAt,
          lastState: t.lastState,
          isOnline: t.lastSeenAt && Date.now() - t.lastSeenAt < 5 * 60 * 1000,
        }))
        .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt)),
    };

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching dashboard data",
    });
  }
};
