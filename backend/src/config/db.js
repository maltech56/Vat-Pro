const { Pool } = require("pg");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL || "";

console.log("================================");
console.log("DATABASE_URL:", databaseUrl);

const dbName =
  databaseUrl.split("/").pop().split("?")[0];

console.log("DATABASE NAME:", dbName);
console.log("================================");

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
  .query(`
    SELECT
      current_database() AS db,
      current_user AS db_user,
      inet_server_addr() AS host,
      inet_server_port() AS port
  `)
  .then((result) => {
    console.log("================================");
    console.log("✅ PostgreSQL Connected");
    console.log("DATABASE:", result.rows[0].db);
    console.log("USER:", result.rows[0].db_user);
    console.log("HOST:", result.rows[0].host);
    console.log("PORT:", result.rows[0].port);
    console.log("================================");
  })
  .catch((err) =>
    console.error("❌ DB Connection Error:", err)
  );

  module.exports = pool;