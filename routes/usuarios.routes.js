const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired, allowRoles } = require('../middleware/auth.js');

const router = Router();

/**
 * GET /api/usuarios
 * Lista todos los usuarios (solo accesible para superadmin y admin)
 */
router.get('/', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  try {
    const rows = await pool.query(`
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

/**
 * PUT /api/usuarios/:id
 * Actualiza los datos de un usuario (solo superadmin y admin)
 */
router.put('/:id', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, correo, rol_id, activo } = req.body;

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

    if (!fields.length) {
      return res.status(400).json({ message: 'No se enviaron campos para actualizar' });
    }

    const sql = `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    const result = await pool.query(sql, values);

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
