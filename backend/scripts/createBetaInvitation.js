const crypto = require("node:crypto");
const pool = require("../src/config/db");

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Provide a valid invitation email address");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256")
    .update(token)
    .digest("hex");

  await pool.query(
    `INSERT INTO beta_invitations
       (email, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [email, tokenHash]
  );

  console.log("Invitation created for:", email);
  console.log("Invitation token:", token);
  console.log("Expires in: 7 days");
}

main()
  .catch(error => {
    console.error("Invitation creation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
