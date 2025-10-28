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

// Login híbrido: acepta usuario O correo
router.post('/login', async (req, res) => {
  try {
    // puedes mandar cualquiera:
    // { "usuario": "...", "password": "..." }
    // { "correo":  "...", "password": "..." }
    // o un solo campo "identificador": { "identificador": "...", "password": "..." }
    const { usuario, correo, identificador, password } = req.body;

    const idRaw = (identificador ?? usuario ?? correo ?? '').toString().trim();
    if (!idRaw || !password) {
      return res.status(400).json({ message: 'Credenciales incompletas (usuario/correo y contraseña requeridos)' });
    }

    // Normaliza si parece correo
    const looksEmail = idRaw.includes('@');
    const idNorm = looksEmail ? idRaw.toLowerCase() : idRaw;

    // Busca tanto por usuario como por correo (seguro y flexible)
    const rows = await pool.query(
      `SELECT id, usuario, nombre, apellido, correo, password_hash, rol_id, activo
       FROM usuarios
       WHERE usuario = ? OR LOWER(correo) = ? 
       LIMIT 1`,
      [idNorm, idNorm]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Usuario/correo o contraseña inválidos' });
    }

    const u = rows[0];
    if (!u.activo) {
      return res.status(403).json({ message: 'Usuario inactivo' });
    }

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Usuario/correo o contraseña inválidos' });
    }

    const rol = nombreRol(u.rol_id); // mapea 1..4 → superadmin/admin/editor/lector
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
    console.error(e);
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
