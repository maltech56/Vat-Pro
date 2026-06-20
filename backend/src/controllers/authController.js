const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const createDefaultCompanySettings = require("../utils/createDefaultCompanySettings");

// ================= LOGIN =================
exports.login = async (req, res) => {
  try {
    console.log("LOGIN START");

    const { email, password } = req.body;
    console.log("EMAIL:", email);

    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    console.log("QUERYING USER");

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    console.log("USER QUERY COMPLETE");

    if (result.rows.length === 0) {
      console.log("USER NOT FOUND");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    console.log("USER FOUND:", user.id);

    const isMatch = await bcrypt.compare(password, user.password);

    console.log("PASSWORD CHECK COMPLETE");

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("CREATING JWT");

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    console.log("LOGIN SUCCESS");

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "admin",
      },
    });

  } catch (error) {
    console.error("LOGIN CRASH:", error);
    console.error(error.stack);

    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.register = async (req, res) => {
  let client;

  try {
    const {
      companyName,
      email,
      password,
      phone
    } = req.body;

    console.log("REGISTER BODY:", req.body);

    if (!companyName || !email || !password) {
      console.log("MISSING FIELD DETECTED");
      return res.status(400).json({
        error: "Company name, email and password are required"
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log("EMAIL ALREADY EXISTS:", email);

      return res.status(400).json({
        error: "Email already exists"
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `
      INSERT INTO users
      (
        email,
        password,
        role
      )
      VALUES
      (
        $1,
        $2,
        'admin'
      )
      RETURNING *
      `,
      [email, hashedPassword]
    );

    const user = userResult.rows[0];

    const companyResult = await client.query(
      `
      INSERT INTO companies
      (
        name,
        email,
        phone,
        trial_start_date,
        trial_end_date,
        subscription_status
      )
      VALUES
      (
        $1,
        $2,
        $3,
        NOW(),
        NOW() + INTERVAL '14 days',
        'TRIAL'
      )
      RETURNING *
      `,
      [
        companyName,
        email,
        phone || null
      ]
    );

    const company = companyResult.rows[0];

    await client.query(
      `
      INSERT INTO user_companies
      (
        user_id,
        company_id,
        role
      )
      VALUES
      (
        $1,
        $2,
        'admin'
      )
      `,
      [user.id, company.id]
    );

    await createDefaultCompanySettings(
      company.id,
      client
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      userId: user.id,
      companyId: company.id,
      trialEnds: company.trial_end_date
    });

  } catch (error) {

    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      error: "Registration failed"
    });

  } finally {

    if (client) {
      client.release();
    }

  }
};

// ================= CHANGE PASSWORD =================
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Current password and new password are required",
      });
    }

    const result = await pool.query(
      "SELECT id, email, role, password FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        error: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, userId]
    );

    return res.json({
      message: "Password changed successfully",
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      error: "Failed to change password",
    });
  }
};