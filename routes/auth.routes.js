// routes/auth.routes.js
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/config.db.js');
const { authRequired, allowRoles } = require('../middleware/auth.js');

const router = Router();

// Mapa de IDs a nombres (ajústalo si tu catálogo cambia)
const ROLES = { 1: 'superadmin', 2: 'admin', 3: 'editor', 4: 'lector' };
const DEFAULT_ROL_ID = 3; // editor

function nombreRol(rol_id) {
  return ROLES[Number(rol_id)] || 'lector';
}

// Registrar usuario (solo superadmin/admin)
router.post('/register', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  try {
    let { usuario, nombre, apellido, correo, password, rol_id = DEFAULT_ROL_ID, activo = 1 } = req.body;

    if (!usuario || !nombre || !apellido || !correo || !password) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    // Normaliza y valida rol_id
    rol_id = Number(rol_id);
    if (!ROLES[rol_id]) {
      return res.status(400).json({ message: 'rol_id inválido. Usa 1(superadmin), 2(admin), 3(editor), 4(lector).' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuarios (usuario, nombre, apellido, correo, password_hash, rol_id, activo) VALUES (?,?,?,?,?,?,?)',
      [usuario, nombre, apellido, correo, hash, rol_id, activo]
    );
    res.status(201).json({ message: 'Usuario creado' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Usuario o correo ya existe' });
    res.status(500).json({ message: 'Error al crear usuario', error: String(e) });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ message: 'Credenciales incompletas' });

    const rows = await pool.query(
      'SELECT id, usuario, nombre, apellido, correo, password_hash, rol_id, activo FROM usuarios WHERE usuario = ?',
      [usuario]
    );
    if (!rows.length) return res.status(401).json({ message: 'Usuario/contraseña inválidos' });

    const u = rows[0];
    if (!u.activo) return res.status(403).json({ message: 'Usuario inactivo' });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ message: 'Usuario/contraseña inválidos' });

    const rol = nombreRol(u.rol_id); // ← nombre para el middleware
    const token = jwt.sign(
      { id: u.id, usuario: u.usuario, rol_id: u.rol_id, rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: u.id,
        usuario: u.usuario,
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        rol_id: u.rol_id,
        rol
      }
    });
  } catch (e) {
    res.status(500).json({ message: 'Error al iniciar sesión', error: String(e) });
  }
});

// Yo (perfil)
router.get('/me', authRequired, async (req, res) => {
  try {
    const rows = await pool.query(
      'SELECT id, usuario, nombre, apellido, correo, rol_id, activo, creado_en FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
    const u = rows[0];
    res.json({ ...u, rol: nombreRol(u.rol_id) });
  } catch (e) {
    res.status(500).json({ message: 'Error', error: String(e) });
  }
});

module.exports = router;
