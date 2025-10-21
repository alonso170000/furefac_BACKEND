// routes/categorias.routes.js
const { Router } = require('express');
const { pool } = require('../config/config.db');
const { authRequired, allowRoles } = require('../middleware/auth');

const router = Router();

// Listar
router.get('/', async (_req, res) => {
  const rows = await pool.query('SELECT id, nombre, slug, creado_en FROM categorias ORDER BY nombre ASC');
  res.json(rows);
});

// Crear
router.post('/', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { nombre, slug = null } = req.body;
  if (!nombre) return res.status(400).json({ message: 'nombre requerido' });
  try {
    await pool.query('INSERT INTO categorias (nombre, slug) VALUES (?, ?)', [nombre, slug]);
    res.status(201).json({ message: 'Categoría creada' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Nombre/slug ya existe' });
    res.status(500).json({ message: 'Error', error: String(e) });
  }
});

// Detalle
router.get('/:id', async (req, res) => {
  const rows = await pool.query('SELECT id, nombre, slug, creado_en FROM categorias WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'No encontrada' });
  res.json(rows[0]);
});

// Actualizar
router.put('/:id', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { nombre, slug } = req.body;
  await pool.query('UPDATE categorias SET nombre=COALESCE(?, nombre), slug=COALESCE(?, slug) WHERE id=?', [nombre || null, slug || null, req.params.id]);
  res.json({ message: 'Actualizada' });
});

// Eliminar
router.delete('/:id', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  await pool.query('DELETE FROM categorias WHERE id=?', [req.params.id]);
  res.json({ message: 'Eliminada' });
});

module.exports = router;
