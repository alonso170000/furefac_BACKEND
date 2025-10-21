// routes/contactos.routes.js
const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired, allowRoles } = require('../middleware/auth.js');

const router = Router();

// Listar
router.get('/', authRequired, allowRoles('superadmin','admin','editor','lector'), async (_req, res) => {
  const rows = await pool.query('SELECT id, nombre, numero, correo, creado_en FROM contactos ORDER BY creado_en DESC');
  res.json(rows);
});

// Crear
router.post('/', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { nombre, numero, correo } = req.body;
  if (!nombre || !numero || !correo) return res.status(400).json({ message: 'nombre, numero, correo requeridos' });
  await pool.query('INSERT INTO contactos (nombre, numero, correo) VALUES (?,?,?)', [nombre, numero, correo]);
  res.status(201).json({ message: 'Contacto creado' });
});

// Actualizar
router.put('/:id', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { nombre, numero, correo } = req.body;
  await pool.query(
    'UPDATE contactos SET nombre=COALESCE(?, nombre), numero=COALESCE(?, numero), correo=COALESCE(?, correo) WHERE id=?',
    [nombre || null, numero || null, correo || null, req.params.id]
  );
  res.json({ message: 'Contacto actualizado' });
});

// Eliminar
router.delete('/:id', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  await pool.query('DELETE FROM contactos WHERE id=?', [req.params.id]);
  res.json({ message: 'Contacto eliminado' });
});

module.exports = router;
