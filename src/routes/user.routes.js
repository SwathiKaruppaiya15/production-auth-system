const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { requireOwnershipOrAdmin } = require("../middleware/ownership.middleware");

// User profile routes (ownership-based access control)
router.get("/profile/:id", authMiddleware, requireOwnershipOrAdmin, adminController.getUserById);

module.exports = router;
