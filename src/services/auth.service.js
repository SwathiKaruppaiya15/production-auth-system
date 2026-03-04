const { v4: uuidv4 } = require("uuid");
const userModel = require("../models/user.model");
const refreshTokenModel = require("../models/refresh-token.model");
const hashUtil = require("../utils/hash");
const jwtUtil = require("../utils/jwt");
const tokenService = require("./token.service");
const emailService = require("./email.service");
const tokenUtil = require("../utils/token.util");

/*
Signup service
*/
exports.signup = async ({ email, password }) => {

  const existingUser = await userModel.findByEmail(email);

  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await hashUtil.hashPassword(password);

  const newUser = await userModel.createUser({
    id: uuidv4(),
    email,
    password: hashedPassword
  });

  // Generate and store verification token
  const { token: verificationToken, expiresAt } = tokenUtil.generateVerificationToken();
  const hashedVerificationToken = tokenUtil.hashToken(verificationToken);
  
  await userModel.setVerificationToken(email, hashedVerificationToken, expiresAt);
  
  // Send verification email
  try {
    await emailService.sendVerificationEmail(email, verificationToken);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    // Don't fail signup if email fails, but log it
  }

  return {
    user: newUser,
    message: "Account created successfully. Please check your email to verify your account."
  };
};

/*
Login service
*/
exports.login = async ({ email, password }) => {

  const isLocked = await userModel.isAccountLocked(email);
  if (isLocked) {
    throw new Error("Account temporarily locked. Please try again later");
  }

  const user = await userModel.findByEmail(email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Check if email is verified
  if (!user.is_verified) {
    throw new Error("Please verify your email before logging in");
  }

  const isMatch = await hashUtil.comparePassword(
    password,
    user.password
  );

  if (!isMatch) {
    await userModel.incrementFailedAttempts(email);
    throw new Error("Invalid email or password");
  }

  await userModel.resetFailedAttempts(email);

  const accessToken = jwtUtil.generateAccessToken(user);
  
  const refreshToken = tokenService.generateRefreshToken();
  const hashedRefreshToken = await tokenService.hashRefreshToken(refreshToken);
  const refreshTokenId = tokenService.generateTokenId();
  const refreshTokenExpiry = tokenService.calculateRefreshTokenExpiry();

  await refreshTokenModel.createRefreshToken({
    id: refreshTokenId,
    user_id: user.id,
    token: hashedRefreshToken,
    expires_at: refreshTokenExpiry
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  };
};

/*
Refresh token service
*/
exports.refreshToken = async (refreshToken) => {
  try {
    const decoded = jwtUtil.verifyRefreshToken(refreshToken);
    
    const user = await userModel.findByEmail(decoded.email);
    if (!user) {
      throw new Error("User not found");
    }

    const hashedRefreshToken = await tokenService.hashRefreshToken(refreshToken);
    const storedToken = await refreshTokenModel.findRefreshToken(user.id, hashedRefreshToken);
    
    if (!storedToken) {
      throw new Error("Invalid refresh token");
    }

    if (tokenService.isTokenExpired(storedToken.expires_at)) {
      await refreshTokenModel.deleteRefreshToken(storedToken.id);
      throw new Error("Refresh token expired");
    }

    await refreshTokenModel.deleteRefreshToken(storedToken.id);

    const newAccessToken = jwtUtil.generateAccessToken(user);
    const newRefreshToken = tokenService.generateRefreshToken();
    const newHashedRefreshToken = await tokenService.hashRefreshToken(newRefreshToken);
    const newRefreshTokenId = tokenService.generateTokenId();
    const newRefreshTokenExpiry = tokenService.calculateRefreshTokenExpiry();

    await refreshTokenModel.createRefreshToken({
      id: newRefreshTokenId,
      user_id: user.id,
      token: newHashedRefreshToken,
      expires_at: newRefreshTokenExpiry
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
};

/*
Logout service
*/
exports.logout = async (refreshToken) => {
  try {
    const decoded = jwtUtil.verifyRefreshToken(refreshToken);
    
    const user = await userModel.findByEmail(decoded.email);
    if (!user) {
      throw new Error("User not found");
    }

    const hashedRefreshToken = await tokenService.hashRefreshToken(refreshToken);
    const storedToken = await refreshTokenModel.findRefreshToken(user.id, hashedRefreshToken);
    
    if (storedToken) {
      await refreshTokenModel.deleteRefreshToken(storedToken.id);
    }

    return { message: "Logged out successfully" };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
};

/*
Verify email service
*/
exports.verifyEmail = async (token) => {
  const hashedToken = tokenUtil.hashToken(token);
  
  const verifiedUser = await userModel.verifyEmail(hashedToken);
  
  if (!verifiedUser) {
    throw new Error("Invalid or expired verification token");
  }

  return {
    message: "Email verified successfully",
    user: {
      id: verifiedUser.id,
      email: verifiedUser.email,
      is_verified: verifiedUser.is_verified
    }
  };
};

/*
Forgot password service
*/
exports.forgotPassword = async (email) => {
  const user = await userModel.findByEmail(email);
  
  // Always return success to prevent email enumeration
  if (!user) {
    return { message: "If an account with that email exists, a password reset link has been sent" };
  }

  const { token: resetToken, expiresAt } = tokenUtil.generatePasswordResetToken();
  const hashedResetToken = tokenUtil.hashToken(resetToken);
  
  await userModel.setPasswordResetToken(email, hashedResetToken, expiresAt);
  
  try {
    await emailService.sendPasswordResetEmail(email, resetToken);
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError);
    // Don't reveal error to user
  }

  return { message: "If an account with that email exists, a password reset link has been sent" };
};

/*
Reset password service
*/
exports.resetPassword = async (token, newPassword) => {
  const hashedToken = tokenUtil.hashToken(token);
  
  const user = await userModel.findByResetToken(hashedToken);
  
  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  const hashedPassword = await hashUtil.hashPassword(newPassword);
  
  // Update password and clear reset token
  await userModel.updatePasswordAndClearResetToken(user.id, hashedPassword);
  
  // Invalidate all refresh tokens for this user
  await refreshTokenModel.deleteAllUserRefreshTokens(user.id);

  return { message: "Password reset successfully" };
};