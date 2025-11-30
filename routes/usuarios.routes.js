const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired } = require('../middleware/auth.js');
const { permiso } = require('../middleware/permisos.js');
const bcrypt = require('bcryptjs');
const router = Router();

/**
 * GET /api/usuarios
 * Lista todos los usuarios (solo accesible para superadmin y admin)
 */
router.get('/', authRequired, permiso('usuarios','reporte'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id,
        u.usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.rol_id,
        r.nombre AS rol_nombre,
        u.activo,
        u.creado_en
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      ORDER BY u.id ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: String(error) });
  }
});

// Crear usuario
router.post(
  "/",
  authRequired,
  permiso("usuarios", "crear"),
  async (req, res) => {
    try {
      const { usuario, nombre, apellido, correo, password, rol_id, activo = 1 } = req.body;

      // Validar campos requeridos
      if (!usuario || !nombre || !apellido || !correo || !password || !rol_id) {
        return res.status(400).json({ message: "Faltan campos requeridos" });
      }

      // Verificar que el rol existe
      const [existRol] = await pool.query(
        "SELECT id FROM roles WHERE id = ?",
        [rol_id]
      );
      if (!existRol.length) {
        return res.status(400).json({ message: "El rol especificado no existe" });
      }

      // Hash de contraseña
      const hash = await bcrypt.hash(password, 10);

      // Insertar usuario
      await pool.query(
        `INSERT INTO usuarios 
         (usuario, nombre, apellido, correo, password_hash, rol_id, activo) 
         VALUES (?,?,?,?,?,?,?)`,
        [usuario, nombre, apellido, correo, hash, rol_id, activo]
      );

      res.status(201).json({ message: "Usuario creado correctamente" });

    } catch (error) {
      console.error(error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Usuario o correo ya existe" });
      }
      res.status(500).json({ message: "Error al crear usuario, prende XAMPP", error: String(error) });
    }
  }
);


/**
 * PUT /api/usuarios/:id
 * Actualiza los datos de un usuario (solo superadmin y admin)
 */
router.put('/:id', authRequired, permiso('usuarios','editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, correo, rol_id, activo, password } = req.body;

    // Validaciones básicas
    if (!id) return res.status(400).json({ message: 'ID de usuario requerido' });

    // Construir query dinámica (solo actualiza los campos enviados)
    const fields = [];
    const values = [];

    if (nombre) { fields.push('nombre = ?'); values.push(nombre); }
    if (apellido) { fields.push('apellido = ?'); values.push(apellido); }
    if (correo) { fields.push('correo = ?'); values.push(correo); }
    if (rol_id) { fields.push('rol_id = ?'); values.push(rol_id); }
    if (activo !== undefined) { fields.push('activo = ?'); values.push(activo); }
    if (password && password.trim()) {
      const hash = await bcrypt.hash(password, 10);
      fields.push('password_hash = ?');
      values.push(hash);
    }

    if (!fields.length) {
      return res.status(400).json({ message: 'No se enviaron campos para actualizar' });
    }

    const sql = `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar usuario', error: String(error) });
  }
});

module.exports = router;
