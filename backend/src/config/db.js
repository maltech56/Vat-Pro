const { Pool } = require("pg");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL || "";

const isRenderDatabase =
  databaseUrl.includes("render.com") || databaseUrl.includes("oregon-postgres");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isRenderDatabase
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

pool
  .query("SELECT NOW()")
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

module.exports = pool;