const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Resend } = require("resend");
const createDefaultCompanySettings = require("../utils/createDefaultCompanySettings");

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const dbInfo = await pool.query(`
  SELECT
    current_database() AS db,
    current_user AS db_user
`);

    console.log("DB INFO:", dbInfo.rows[0]);

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    console.log("USER QUERY COMPLETE");

    if (result.rows.length === 0) {
      console.log("USER NOT FOUND:", email);

      return res.status(401).json({
        message: "Invalid credentials"
      });
    }
    const user = result.rows[0];

    console.log("USER FOUND:", user.id);

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    console.log("ISMATCH:", isMatch);
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
      console.log("PASSWORD MISMATCH FOR:", email);

      return res.status(401).json({
        message: "Invalid credentials"
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

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    // Always return the same response so callers cannot determine
    // whether a particular email address exists in VAT Pro.
    const genericResponse = {
      message:
        "If an account exists for that email address, a password reset link has been sent.",
    };

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const result = await pool.query(
      `
      SELECT id, email
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.json(genericResponse);
    }

    const user = result.rows[0];

    // Invalidate any previous unused reset tokens for this user.
    await pool.query(
      `
      UPDATE password_reset_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [user.id]
    );

    // The plaintext token goes only into the email.
    // PostgreSQL stores only its SHA-256 hash.
    const resetToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await pool.query(
      `
      INSERT INTO password_reset_tokens
      (
        user_id,
        token_hash,
        expires_at
      )
      VALUES
      (
        $1,
        $2,
        CURRENT_TIMESTAMP + INTERVAL '30 minutes'
      )
      `,
      [user.id, tokenHash]
    );

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      console.error("PASSWORD RESET ERROR: FRONTEND_URL is not configured");

      return res.status(500).json({
        error: "Password reset is temporarily unavailable",
      });
    }

    const resetUrl =
      `${frontendUrl.replace(/\/$/, "")}` +
      `/reset-password?token=${encodeURIComponent(resetToken)}`;

    const emailResult = await resend.emails.send({
      from: "Maltech VAT Pro <noreply@maltechenterprises.com>",
      to: user.email,
      subject: "Reset Your Maltech VAT Pro Password",
      html: `
        <h2>Reset Your Password</h2>

        <p>
          We received a request to reset the password for your
          Maltech VAT Pro account.
        </p>

        <p>
          <a href="${resetUrl}">Reset your password</a>
        </p>

        <p>
          This link will expire in 30 minutes and can only be used once.
        </p>

        <p>
          If you did not request this reset, you can ignore this email.
        </p>

        <p>
          Regards,<br />
          Maltech VAT Pro
        </p>
      `,
    });

    if (emailResult.error) {
      console.error(
        "PASSWORD RESET EMAIL ERROR:",
        emailResult.error
      );

      await pool.query(
        `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token_hash = $1
          AND used_at IS NULL
        `,
        [tokenHash]
      );

      return res.json(genericResponse);
    }

    return res.json(genericResponse);

  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      error: "Password reset is temporarily unavailable",
    });
  }
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  const client = await pool.connect();

  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: "Reset token and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "New password must be at least 8 characters",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    await client.query("BEGIN");

    const tokenResult = await client.query(
      `
      SELECT
        prt.id,
        prt.user_id
      FROM password_reset_tokens prt
      WHERE prt.token_hash = $1
        AND prt.used_at IS NULL
        AND prt.expires_at > CURRENT_TIMESTAMP
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Reset link is invalid or has expired",
      });
    }

    const resetRecord = tokenResult.rows[0];

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    const userResult = await client.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
      RETURNING id
      `,
      [
        hashedPassword,
        resetRecord.user_id,
      ]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Unable to reset password",
      });
    }

    // Consume this token and invalidate any other outstanding
    // password-reset tokens belonging to the same user.
    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [resetRecord.user_id]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Password reset successfully",
    });

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "PASSWORD RESET ROLLBACK ERROR:",
        rollbackError
      );
    }

    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      error: "Failed to reset password",
    });

  } finally {
    client.release();
  }
};
