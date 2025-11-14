// routes/cotizaciones.routes.js
const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired } = require('../middleware/auth.js');
const { permiso } = require('../middleware/permisos.js');

const router = Router();

// Crear cotización (público)
router.post('/', async (req, res) => {
  const {
    producto_id = null, nombre_usuario, correo, telefono, descripcion,
    producto_nombre_snap = null, producto_precio_snap = null, producto_categoria_snap = null
  } = req.body;

  if (!nombre_usuario || !correo || !telefono || !descripcion) {
    return res.status(400).json({ message: 'Campos obligatorios: nombre_usuario, correo, telefono, descripcion' });
  }

  await pool.query(
    `INSERT INTO cotizaciones
     (producto_id, nombre_usuario, correo, telefono, descripcion,
      producto_nombre_snap, producto_precio_snap, producto_categoria_snap)
     VALUES (?,?,?,?,?,?,?,?)`,
    [producto_id, nombre_usuario, correo, telefono, descripcion,
     producto_nombre_snap, producto_precio_snap, producto_categoria_snap]
  );

  res.status(201).json({ message: 'Cotización enviada' });
});

// Buzón: listar (solo internos)
router.get('/buzon', authRequired, permiso('buzon','reporte'), async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM vw_buzon_cotizaciones ORDER BY fecha DESC');
  res.json(rows);
});

// Soft delete
router.delete('/:id', authRequired, permiso('cotizaciones','eliminar'), async (req, res) => {
  await pool.query('UPDATE cotizaciones SET eliminado=1 WHERE id=?', [req.params.id]);
  res.json({ message: 'Cotización eliminada (soft)' });
});

// Imágenes de cotización (guardar ruta/orden)
router.get('/:id/imagenes', authRequired, permiso('cotizaciones','reporte'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, ruta, orden, creado_en FROM cotizacion_imagenes WHERE cotizacion_id=? ORDER BY orden ASC, id ASC', [req.params.id]);
  res.json(rows);
});

router.post('/:id/imagenes', async (req, res) => {
  const { ruta, orden = 1 } = req.body;
  if (!ruta) return res.status(400).json({ message: 'ruta requerida' });
  try {
    await pool.query('INSERT INTO cotizacion_imagenes (cotizacion_id, ruta, orden) VALUES (?,?,?)', [req.params.id, ruta, orden]);
    res.status(201).json({ message: 'Imagen agregada' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ya existe imagen con ese orden' });
    res.status(500).json({ message: 'Error', error: String(e) });
  }
});

router.delete('/imagenes/:imgId', authRequired, permiso('cotizaciones','eliminar'), async (req, res) => {
  await pool.query('DELETE FROM cotizacion_imagenes WHERE id=?', [req.params.imgId]);
  res.json({ message: 'Imagen eliminada' });
});

module.exports = router;
