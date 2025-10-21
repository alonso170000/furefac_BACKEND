// routes/comentarios.routes.js
const { Router } = require('express');
const { pool } = require('../config/config.db');
const { authRequired, allowRoles } = require('../middleware/auth');

const router = Router();

// Enviar comentario (público)
router.post('/', async (req, res) => {
  const { nombre, correo, telefono, comentario } = req.body;
  if (!nombre || !correo || !telefono || !comentario) {
    return res.status(400).json({ message: 'nombre, correo, telefono, comentario requeridos' });
  }
  await pool.query('INSERT INTO comentarios (nombre, correo, telefono, comentario) VALUES (?,?,?,?)',
    [nombre, correo, telefono, comentario]);
  res.status(201).json({ message: 'Comentario enviado' });
});

// Buzón (vista opcional vw_buzon_comentarios)
router.get('/buzon', authRequired, allowRoles('superadmin','admin','editor','lector'), async (_req, res) => {
  const rows = await pool.query('SELECT * FROM vw_buzon_comentarios ORDER BY fecha DESC');
  res.json(rows);
});

// Soft delete
router.delete('/:id', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  await pool.query('UPDATE comentarios SET eliminado=1 WHERE id=?', [req.params.id]);
  res.json({ message: 'Comentario eliminado (soft)' });
});

module.exports = router;
