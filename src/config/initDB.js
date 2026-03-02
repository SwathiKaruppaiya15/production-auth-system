const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function initDB() {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Tables created successfully");
    process.exit();
  } catch (err) {
    console.error("Error creating tables:", err.message);
    process.exit(1);
  }
}

initDB();