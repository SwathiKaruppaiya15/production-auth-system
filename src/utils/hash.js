const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

/*
Hash password before saving
*/
exports.hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/*
Compare password during login (for later use)
*/
exports.comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};