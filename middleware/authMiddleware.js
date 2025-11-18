import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user data from token
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Role-based access (admin or superadmin)
export const adminOnly = (req, res, next) => {
  if (req.user.roles !== "admin" && req.user.roles !== "superadmin") {
    return res.status(403).json({ message: "Access forbidden: Admins only" });
  }
  next();
};

// Superadmin-only access
export const superadminOnly = (req, res, next) => {
  if (req.user.roles !== "superadmin") {
    return res
      .status(403)
      .json({ message: "Access forbidden: Superadmin only" });
  }
  next();
};
