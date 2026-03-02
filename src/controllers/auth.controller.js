const authService = require("../services/auth.service");

exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    const user = await authService.signup({ email, password });

    res.status(201).json({
      message: "User created successfully",
      user
    });

  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login({ email, password });

    res.status(200).json(result);

  } catch (err) {
    res.status(401).json({
      error: err.message
    });
  }
};