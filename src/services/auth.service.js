const { v4: uuidv4 } = require("uuid");
const userModel = require("../models/user.model");
const refreshTokenModel = require("../models/refresh-token.model");
const hashUtil = require("../utils/hash");
const jwtUtil = require("../utils/jwt");
const tokenService = require("./token.service");

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

  return newUser;
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