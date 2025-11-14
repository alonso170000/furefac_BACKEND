// middleware/auth.js
const jwt = require("jsonwebtoken");
const { pool } = require("../config/config.db.js");

async function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No autenticado" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload debe traer userId (o como lo hayas llamado)
    const [rows] = await pool.query(
      `SELECT u.id, u.usuario, u.rol_id, r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.id=? AND u.activo=1
       LIMIT 1`,
      [payload.id]
    );
    if (!rows.length) return res.status(401).json({ message: "Usuario inactivo o inválido" });

    req.usuario = rows[0];
    next();
  } catch (e) {
    console.error(e);
    res.status(401).json({ message: "Token inválido" });
  }
}

module.exports = { authRequired };
