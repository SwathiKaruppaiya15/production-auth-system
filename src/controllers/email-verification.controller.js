const authService = require("../services/auth.service");

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required"
      });
    }

    const result = await authService.verifyEmail(token);

    res.status(200).json({
      success: true,
      message: result.message,
      user: result.user
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const result = await authService.forgotPassword(email);

    res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    const result = await authService.resetPassword(token, newPassword);

    res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
