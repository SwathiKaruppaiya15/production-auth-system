const express = require("express");
const authRoutes = require("./auth.routes");
const adminRoutes = require("./admin.routes");
const userRoutes = require("./user.routes");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Routes working"
  });
});

router.get("/db-test", async (req, res) => {
  const pool = require("../config/db");
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows);
});

// Route modules
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/users", userRoutes);

module.exports = router;