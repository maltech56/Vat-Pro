const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    console.log(
      "VERIFYING JWT WITH:",
      process.env.JWT_SECRET
    );

    console.log(
      "TOKEN RECEIVED:",
      token
    );

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
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