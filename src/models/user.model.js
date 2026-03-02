const pool = require("../config/db");

/*
Create a new user in database
*/
exports.createUser = async ({ id, email, password }) => {
  const query = `
    INSERT INTO users (id, email, password)
    VALUES ($1, $2, $3)
    RETURNING id, email, role, created_at
  `;

  const values = [id, email, password];

  const result = await pool.query(query, values);

  return result.rows[0];
};

/*
Find user by email
*/
exports.findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return result.rows[0];
};