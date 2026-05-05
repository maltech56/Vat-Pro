const { Pool } = require("pg");
require("dotenv").config();

const isRenderInternalDb =
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL.includes(".render.com") === false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRenderInternalDb
    ? false
    : {
        rejectUnauthorized: false,
      },
});

pool
  .query("SELECT NOW()")
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

module.exports = pool;