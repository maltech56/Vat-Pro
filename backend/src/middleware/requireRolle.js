module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRole = req.user.role;

    if (!userRole) {
      return res.status(403).json({ error: "No role assigned" });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Access denied: insufficient permissions",
      });
    }

    next();
  };
};