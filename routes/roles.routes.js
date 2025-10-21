const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired, allowRoles } = require('../middleware/auth.js');

const router = Router();

// Listar roles
router.get('/', authRequired, allowRoles('superadmin','admin'), async (_req, res) => {
  const rows = await pool.query('SELECT id, nombre, creado_en FROM roles ORDER BY id ASC');
  res.json(rows);
});

// Crear rol
router.post('/', authRequired, allowRoles('superadmin'), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: 'nombre requerido' });
  try {
    await pool.query('INSERT INTO roles (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ message: 'Rol creado' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'El rol ya existe' });
    res.status(500).json({ message: 'Error', error: String(e) });
  }
});

// Actualizar rol
router.put('/:id', authRequired, allowRoles('superadmin'), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: 'nombre requerido' });
  await pool.query('UPDATE roles SET nombre=? WHERE id=?', [nombre, req.params.id]);
  res.json({ message: 'Rol actualizado' });
});

// Eliminar rol (borra permisos por ON DELETE CASCADE)
router.delete('/:id', authRequired, allowRoles('superadmin'), async (req, res) => {
  await pool.query('DELETE FROM roles WHERE id=?', [req.params.id]);
  res.json({ message: 'Rol eliminado' });
});

module.exports = router;
