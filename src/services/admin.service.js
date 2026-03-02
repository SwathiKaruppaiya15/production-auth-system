const userModel = require("../models/user.model");

/*
Get all users (admin only)
*/
exports.getAllUsers = async () => {
  const users = await userModel.getAllUsers();
  return users;
};

/*
Get user by ID (with authorization check in service)
*/
exports.getUserById = async (userId, requesterId, requesterRole) => {
  const user = await userModel.findById(userId);
  
  if (!user) {
    throw new Error("User not found");
  }

  // Authorization check: users can only see their own data, admins can see any
  if (requesterRole !== 'admin' && userId !== requesterId) {
    throw new Error("Access denied: You can only access your own data");
  }

  return user;
};

/*
Update user role (admin only)
*/
exports.updateUserRole = async (userId, newRole, requesterRole) => {
  // Only admins can update roles
  if (requesterRole !== 'admin') {
    throw new Error("Access denied: Only admins can update roles");
  }

  const updatedUser = await userModel.updateUserRole(userId, newRole);
  
  if (!updatedUser) {
    throw new Error("User not found");
  }

  return updatedUser;
};

/*
Delete user (admin only, with self-deletion protection)
*/
exports.deleteUser = async (userId, requesterId, requesterRole) => {
  // Only admins can delete users
  if (requesterRole !== 'admin') {
    throw new Error("Access denied: Only admins can delete users");
  }

  // Prevent admins from deleting themselves
  if (userId === requesterId) {
    throw new Error("Access denied: You cannot delete your own account");
  }

  const deletedUser = await userModel.deleteUser(userId);
  
  if (!deletedUser) {
    throw new Error("User not found");
  }

  return deletedUser;
};
