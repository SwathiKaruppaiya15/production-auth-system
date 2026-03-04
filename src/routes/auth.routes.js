const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const emailVerificationController = require("../controllers/email-verification.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { authRateLimit, passwordResetRateLimit } = require("../middleware/rateLimit.middleware");
const { validate, authSchemas } = require("../middleware/validation.middleware");

router.post("/signup", authRateLimit, validate(authSchemas.signup), authController.signup);
router.post("/login", authRateLimit, validate(authSchemas.login), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

// Email verification and password reset with enhanced rate limiting
router.get("/verify-email", emailVerificationController.verifyEmail);
router.post("/forgot-password", passwordResetRateLimit, emailVerificationController.forgotPassword);
router.post("/reset-password", emailVerificationController.resetPassword);

router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user
  });
});

module.exports = router;