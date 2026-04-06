const jwt = require("jsonwebtoken");
// require("dotenv").config();

// exports.auth = (req, res, next) => {
//     try {
//         const token = req.body.token || req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");
//         // const token =  req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");
//         if (!token) {
//             return res.status(401).json({ success: false, message: 'Token Missing' });
//         }

//         try {
//             const decode = jwt.verify(token, process.env.JWT_SECRET);
//             req.user = decode;
//         } catch (e) {
//             return res.status(401).json({ success: false, message: "Invalid token" });
//         }

//         next();
//     } catch (err) {
//         return res.status(401).json({ success: false, message: "Token verification failed" });
//     }
// };
exports.auth = (req, res, next) => {
  try {
    const token =
      req.cookies.token ||
      req.body.token ||
      req.header("Authorization")?.replace("Bearer ", "");

    console.log("🔐 Token received by middleware:", token);

    if (!token) {
      return res.status(401).json({ success: false, message: "Token Missing" });
    }

    try {
      const decode = jwt.verify(token, process.env.JWT_SECRET);
      console.log("✅ Decoded token:", decode);
      req.user = decode;
      next();
    } catch (e) {
      console.error("❌ JWT verification error:", e.message);
      return res.status(401).json({ success: false, message: "Token verification failed" });
    }
  } catch (err) {
    console.error("Middleware error:", err.message);
    return res.status(401).json({ success: false, message: "Token verification failed" });
  }
};
