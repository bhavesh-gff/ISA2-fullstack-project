const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "smart_salon_secret_key_123";

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access Denied. No token provided.",
    });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};
const isAdmin = (req, res, next) => {
  const userRole =
    req.user && req.user.role ? req.user.role.toLowerCase().trim() : "";

  if (userRole === "admin") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Access Denied. Admin privileges required.",
    });
  }
};

module.exports = { verifyToken, isAdmin };
