// routes/contactos.routes.js
const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired } = require('../middleware/auth.js');
const { permiso } = require('../middleware/permisos.js');

const router = Router();

// Listar
router.get('/', authRequired, permiso('contactos','reporte'), async (_req, res) => {
  const [rows] = await pool.query('SELECT id, nombre, numero, correo, activo, creado_en FROM contactos ORDER BY creado_en DESC');
  res.json(rows);
});

// Crear
router.post('/', authRequired, permiso('contactos','crear'), async (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  const numero = (req.body.numero || '').trim();
  const correo = (req.body.correo || '').trim();
  const activoRaw = req.body.activo;
  const activo = (activoRaw === false || activoRaw === 'false' || activoRaw === 0 || activoRaw === '0') ? 0 : 1;

  if (!nombre || (!numero && !correo)) {
    return res.status(400).json({ message: 'Nombre y al menos un contacto (numero o correo) son requeridos' });
  }

  await pool.query('INSERT INTO contactos (nombre, numero, correo, activo) VALUES (?,?,?,?)', [
    nombre,
    numero,
    correo,
    activo,
  ]);
  res.status(201).json({ message: 'Contacto creado' });
});

// Actualizar
router.put('/:id', authRequired, permiso('contactos','editar'), async (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  const numero = (req.body.numero || '').trim();
  const correo = (req.body.correo || '').trim();
  const activoRaw = req.body.activo;
  const activo = activoRaw === undefined
    ? null
    : (activoRaw === false || activoRaw === 'false' || activoRaw === 0 || activoRaw === '0') ? 0 : 1;

  if (!nombre || (!numero && !correo)) {
    return res.status(400).json({ message: 'Nombre y al menos un contacto (numero o correo) son requeridos' });
  }

  await pool.query(
    'UPDATE contactos SET nombre=?, numero=?, correo=?, activo=COALESCE(?, activo) WHERE id=?',
    [nombre, numero, correo, activo, req.params.id]
  );
  res.json({ message: 'Contacto actualizado' });
});

// Eliminar
router.delete('/:id', authRequired, permiso('contactos','eliminar'), async (req, res) => {
  await pool.query('DELETE FROM contactos WHERE id=?', [req.params.id]);
  res.json({ message: 'Contacto eliminado' });
});

module.exports = router;
