// routes/productos.routes.js
const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired, allowRoles } = require('../middleware/auth');

const router = Router();

// Listado con filtros simples ?q=&categoria_id=&activo=1
router.get('/', async (req, res) => {
  const { q, categoria_id, activo } = req.query;
  const where = [];
  const params = [];
  if (q) { where.push('p.nombre LIKE ?'); params.push(`%${q}%`); }
  if (categoria_id) { where.push('p.categoria_id=?'); params.push(categoria_id); }
  if (activo !== undefined) { where.push('p.activo=?'); params.push(Number(activo)); }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await pool.query(
    `SELECT p.id, p.nombre, p.descripcion, p.precio_mxn, p.categoria_id, p.activo, p.creado_en, p.actualizado_en,
            c.nombre AS categoria
     FROM productos p
     JOIN categorias c ON c.id = p.categoria_id
     ${sqlWhere}
     ORDER BY p.creado_en DESC`,
    params
  );
  res.json(rows);
});

// Crear
router.post('/', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { nombre, descripcion = null, precio_mxn, categoria_id, activo = 1 } = req.body;
  if (!nombre || precio_mxn == null || !categoria_id) {
    return res.status(400).json({ message: 'nombre, precio_mxn, categoria_id son requeridos' });
  }
  await pool.query(
    'INSERT INTO productos (nombre, descripcion, precio_mxn, categoria_id, activo) VALUES (?,?,?,?,?)',
    [nombre, descripcion, precio_mxn, categoria_id, activo]
  );
  res.status(201).json({ message: 'Producto creado' });
});

// Detalle + imágenes
router.get('/:id', async (req, res) => {
  const [prod] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
  if (!prod) return res.status(404).json({ message: 'No encontrado' });
  const imgs = await pool.query('SELECT id, ruta, orden, creado_en FROM producto_imagenes WHERE producto_id=? ORDER BY orden ASC, id ASC', [req.params.id]);
  res.json({ ...prod, imagenes: imgs });
});

// Actualizar
router.put('/:id', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { nombre, descripcion, precio_mxn, categoria_id, activo } = req.body;
  await pool.query(
    `UPDATE productos SET
      nombre = COALESCE(?, nombre),
      descripcion = COALESCE(?, descripcion),
      precio_mxn = COALESCE(?, precio_mxn),
      categoria_id = COALESCE(?, categoria_id),
      activo = COALESCE(?, activo)
     WHERE id=?`,
    [nombre || null, descripcion || null, precio_mxn ?? null, categoria_id ?? null, typeof activo === 'number' ? activo : null, req.params.id]
  );
  res.json({ message: 'Producto actualizado' });
});

// Eliminar
router.delete('/:id', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  await pool.query('DELETE FROM productos WHERE id=?', [req.params.id]);
  res.json({ message: 'Producto eliminado' });
});

// ---- Imagenes de producto (sin subir archivos aquí, solo guardar ruta y orden) ----

// Listar imágenes
router.get('/:id/imagenes', async (req, res) => {
  const rows = await pool.query('SELECT id, ruta, orden, creado_en FROM producto_imagenes WHERE producto_id=? ORDER BY orden ASC, id ASC', [req.params.id]);
  res.json(rows);
});

// Agregar/ordenar imagen
router.post('/:id/imagenes', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { ruta, orden = 1 } = req.body;
  if (!ruta) return res.status(400).json({ message: 'ruta requerida' });
  try {
    await pool.query('INSERT INTO producto_imagenes (producto_id, ruta, orden) VALUES (?,?,?)', [req.params.id, ruta, orden]);
    res.status(201).json({ message: 'Imagen agregada' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ya existe una imagen con ese orden' });
    res.status(500).json({ message: 'Error', error: String(e) });
  }
});

// Actualizar ruta/orden de una imagen
router.put('/imagenes/:imgId', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  const { ruta, orden } = req.body;
  await pool.query('UPDATE producto_imagenes SET ruta = COALESCE(?, ruta), orden = COALESCE(?, orden) WHERE id=?',
    [ruta || null, typeof orden === 'number' ? orden : null, req.params.imgId]);
  res.json({ message: 'Imagen actualizada' });
});

// Eliminar imagen
router.delete('/imagenes/:imgId', authRequired, allowRoles('superadmin','admin','editor'), async (req, res) => {
  await pool.query('DELETE FROM producto_imagenes WHERE id=?', [req.params.imgId]);
  res.json({ message: 'Imagen eliminada' });
});

module.exports = router;
