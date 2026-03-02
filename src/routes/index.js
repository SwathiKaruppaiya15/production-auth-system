const express = require("express");

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

module.exports = router;


const authRoutes = require("./auth.routes");

router.use("/auth", authRoutes);

router.get("/test", (req, res) => {
  res.json({ message: "Routes working" });
});

module.exports = router;