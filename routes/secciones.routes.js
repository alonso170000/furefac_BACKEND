const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired, allowRoles } = require('../middleware/auth.js');

const router = Router();

// Listar secciones
router.get('/', authRequired, allowRoles('superadmin','admin','editor','lector'), async (_req, res) => {
  const rows = await pool.query('SELECT id, nombre FROM secciones ORDER BY id ASC');
  res.json(rows);
});

// Crear sección
router.post('/', authRequired, allowRoles('superadmin'), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: 'nombre requerido' });
  try {
    await pool.query('INSERT INTO secciones (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ message: 'Sección creada' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'La sección ya existe' });
    res.status(500).json({ message: 'Error', error: String(e) });
  }
});

// Actualizar sección
router.put('/:id', authRequired, allowRoles('superadmin'), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: 'nombre requerido' });
  await pool.query('UPDATE secciones SET nombre=? WHERE id=?', [nombre, req.params.id]);
  res.json({ message: 'Sección actualizada' });
});

// Eliminar sección (borra permisos por ON DELETE CASCADE)
router.delete('/:id', authRequired, allowRoles('superadmin'), async (req, res) => {
  await pool.query('DELETE FROM secciones WHERE id=?', [req.params.id]);
  res.json({ message: 'Sección eliminada' });
});

module.exports = router;
