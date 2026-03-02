const { v4: uuidv4 } = require("uuid");
const userModel = require("../models/user.model");
const hashUtil = require("../utils/hash");
const jwtUtil = require("../utils/jwt");

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

  const user = await userModel.findByEmail(email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await hashUtil.comparePassword(
    password,
    user.password
  );

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  const token = jwtUtil.generateAccessToken(user);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  };
};