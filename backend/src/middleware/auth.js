const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Check if header exists
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    // 2. Split "Bearer TOKEN"
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Invalid authorization format" });
    }

    const token = parts[1];

    // 3. Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your_jwt_secret"
    );

    // 4. Attach user to request
    req.user = decoded;

    // 5. Continue
    next();
    } catch (error) {
  console.error("JWT VERIFY ERROR:");
  console.error("Name:", error.name);
  console.error("Message:", error.message);

  return res.status(401).json({
    error: error.message,
  });
}
};