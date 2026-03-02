const adminService = require("../services/admin.service");

/*
Get all users (admin only)
*/
exports.getAllUsers = async (req, res) => {
  try {
    const users = await adminService.getAllUsers();

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/*
Get user by ID (ownership or admin)
*/
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    const user = await adminService.getUserById(id, requesterId, requesterRole);

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user
    });

  } catch (err) {
    const statusCode = err.message.includes("not found") ? 404 : 403;
    res.status(statusCode).json({
      success: false,
      message: err.message
    });
  }
};

/*
Update user role (admin only)
*/
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const requesterRole = req.user.role;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required"
      });
    }

    const updatedUser = await adminService.updateUserRole(id, role, requesterRole);

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: updatedUser
    });

  } catch (err) {
    const statusCode = err.message.includes("not found") ? 404 : 403;
    res.status(statusCode).json({
      success: false,
      message: err.message
    });
  }
};

/*
Delete user (admin only)
*/
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    const deletedUser = await adminService.deleteUser(id, requesterId, requesterRole);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: deletedUser
    });

  } catch (err) {
    const statusCode = err.message.includes("not found") ? 404 : 403;
    res.status(statusCode).json({
      success: false,
      message: err.message
    });
  }
};

/*
Admin dashboard (admin only)
*/
exports.getDashboard = async (req, res) => {
  try {
    const users = await adminService.getAllUsers();
    
    const stats = {
      totalUsers: users.length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      regularUsers: users.filter(u => u.role === 'user').length,
      lockedUsers: users.filter(u => u.locked_until).length,
      recentUsers: users.filter(u => {
        const createdDate = new Date(u.created_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return createdDate > weekAgo;
      }).length
    };

    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: {
        stats,
        recentUsers: users.slice(0, 5)
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
