// routes/auth.routes.js
const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/config.db.js");
const { authRequired } = require("../middleware/auth.js");
const { permiso } = require("../middleware/permisos.js");

const router = Router();

// (Opcional) mapa estático; puedes cambiarlo por una validación contra DB
const ROLES = { 1: "superadmin", 2: "admin", 3: "editor", 4: "lector" };
const DEFAULT_ROL_ID = 3;

function nombreRol(rol_id) {
  return ROLES[Number(rol_id)] || "lector";
}

router.post("/register", authRequired, permiso("usuarios","crear"), async (req, res) => {
  try {
    let { usuario, nombre, apellido, correo, password, rol_id = DEFAULT_ROL_ID, activo = 1 } = req.body;
    if (!usuario || !nombre || !apellido || !correo || !password) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    // (Opcional) validar rol_id contra DB en vez de ROLES
    rol_id = Number(rol_id);
    if (!ROLES[rol_id]) {
      return res.status(400).json({ message: "rol_id inválido" });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO usuarios (usuario, nombre, apellido, correo, password_hash, rol_id, activo) VALUES (?,?,?,?,?,?,?)",
      [usuario, nombre, apellido, correo, hash, rol_id, activo]
    );
    res.status(201).json({ message: "Usuario creado" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Usuario o correo ya existe" });
    res.status(500).json({ message: "Error al crear usuario", error: String(e) });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { usuario, correo, identificador, password } = req.body;
    const idRaw = (identificador ?? usuario ?? correo ?? "").toString().trim();
    if (!idRaw || !password) {
      return res.status(400).json({ message: "Credenciales incompletas (usuario/correo y contraseña requeridos)" });
    }

    const looksEmail = idRaw.includes("@");
    const idNorm = looksEmail ? idRaw.toLowerCase() : idRaw;

    const [rows] = await pool.query(
      `SELECT id, usuario, nombre, apellido, correo, password_hash, rol_id, activo
      FROM usuarios
      WHERE usuario = ? OR LOWER(correo) = ? 
      LIMIT 1`,
      [idNorm, idNorm]
    );

    if (!rows.length) {
      return res
        .status(401)
        .json({ message: "Usuario/correo o contraseña inválidos" });
    }

    const u = rows[0];

    if (!u.activo) {
      return res.status(403).json({ message: "Usuario inactivo" });
    }

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ message: "Usuario/correo o contraseña inválidos" });

    const rol = nombreRol(u.rol_id);
    const token = jwt.sign(
      { id: u.id, usuario: u.usuario, rol_id: u.rol_id, rol }, // ← usa 'id'
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      usuario: { id: u.id, usuario: u.usuario, nombre: u.nombre, apellido: u.apellido, correo: u.correo, rol_id: u.rol_id, rol }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error al iniciar sesión", error: String(e) });
  }
});

router.get("/me", authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, usuario, nombre, apellido, correo, rol_id, activo, creado_en FROM usuarios WHERE id = ?",
      [req.usuario.id] // ← usa req.usuario
    );
    if (!rows.length) return res.status(404).json({ message: "No encontrado" });
    const u = rows[0];
    res.json({ ...u, rol: nombreRol(u.rol_id) });
  } catch (e) {
    res.status(500).json({ message: "Error", error: String(e) });
  }
});

module.exports = router;
