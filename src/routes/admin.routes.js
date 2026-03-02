const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { requireAdmin } = require("../middleware/role.middleware");
const { requireOwnershipOrAdmin } = require("../middleware/ownership.middleware");

// Admin-only routes
router.get("/dashboard", authMiddleware, requireAdmin, adminController.getDashboard);
router.get("/users", authMiddleware, requireAdmin, adminController.getAllUsers);
router.patch("/users/:id/role", authMiddleware, requireAdmin, adminController.updateUserRole);
router.delete("/users/:id", authMiddleware, requireAdmin, adminController.deleteUser);

// Ownership or admin routes
router.get("/users/:id", authMiddleware, requireOwnershipOrAdmin, adminController.getUserById);

module.exports = router;
