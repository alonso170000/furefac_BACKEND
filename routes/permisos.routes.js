const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired, allowRoles } = require('../middleware/auth.js');

const router = Router();

/**
 * GET /api/permisos/:rolId
 * Lista permisos de un rol (con nombre de sección)
 */
router.get('/:rolId', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  const rolId = Number(req.params.rolId);
  const rows = await pool.query(
    `SELECT rp.id, rp.rol_id, rp.seccion_id, s.nombre AS seccion,
            rp.puede_crear, rp.puede_editar, rp.puede_eliminar, rp.puede_reporte
     FROM rol_permisos rp
     JOIN secciones s ON s.id = rp.seccion_id
     WHERE rp.rol_id = ?
     ORDER BY rp.seccion_id ASC`,
    [rolId]
  );
  res.json(rows);
});

/**
 * POST /api/permisos/:rolId/init
 * Inicializa permisos en 0 para TODAS las secciones que no existan para ese rol
 */
router.post('/:rolId/init', authRequired, allowRoles('superadmin'), async (req, res) => {
  const rolId = Number(req.params.rolId);
  await pool.query(
    `INSERT IGNORE INTO rol_permisos (rol_id, seccion_id)
     SELECT ?, s.id FROM secciones s`, [rolId]
  );
  res.status(201).json({ message: 'Permisos inicializados' });
});

/**
 * PUT /api/permisos/:permId
 * Actualiza un permiso específico
 */
router.put('/:permId', authRequired, allowRoles('superadmin','admin'), async (req, res) => {
  const { puede_crear, puede_editar, puede_eliminar, puede_reporte } = req.body;
  await pool.query(
    `UPDATE rol_permisos
     SET
       puede_crear = COALESCE(?, puede_crear),
       puede_editar = COALESCE(?, puede_editar),
       puede_eliminar = COALESCE(?, puede_eliminar),
       puede_reporte = COALESCE(?, puede_reporte)
     WHERE id = ?`,
    [
      typeof puede_crear === 'number' ? puede_crear : null,
      typeof puede_editar === 'number' ? puede_editar : null,
      typeof puede_eliminar === 'number' ? puede_eliminar : null,
      typeof puede_reporte === 'number' ? puede_reporte : null,
      req.params.permId
    ]
  );
  res.json({ message: 'Permiso actualizado' });
});

/**
 * POST /api/permisos/:rolId/bulk
 * Reemplaza los permisos de un rol con un arreglo [{seccion_id, puede_crear, puede_editar, puede_eliminar, puede_reporte}]
 */
router.post('/:rolId/bulk', authRequired, allowRoles('superadmin'), async (req, res) => {
  const rolId = Number(req.params.rolId);
  const items = Array.isArray(req.body) ? req.body : [];
  if (!items.length) return res.status(400).json({ message: 'Arreglo de permisos requerido' });

  // Limpiar los permisos actuales
  await pool.query('DELETE FROM rol_permisos WHERE rol_id=?', [rolId]);

  // Insertar nuevos
  const values = items.map(it => [
    rolId,
    Number(it.seccion_id),
    Number(it.puede_crear) || 0,
    Number(it.puede_editar) || 0,
    Number(it.puede_eliminar) || 0,
    Number(it.puede_reporte) || 0
  ]);

  const placeholders = values.map(() => '(?,?,?,?,?,?)').join(',');
  await pool.query(
    `INSERT INTO rol_permisos (rol_id, seccion_id, puede_crear, puede_editar, puede_eliminar, puede_reporte)
     VALUES ${placeholders}`,
    values.flat()
  );

  res.status(201).json({ message: 'Permisos actualizados' });
});

/**
 * GET /api/permisos/menu/:rolId
 * Devuelve un objeto de "menú" por secciones con flags para el frontend
 */
router.get('/menu/:rolId', authRequired, allowRoles('superadmin','admin','editor','lector'), async (req, res) => {
  const rolId = Number(req.params.rolId);
  const rows = await pool.query(
    `SELECT s.nombre AS seccion, rp.puede_crear, rp.puede_editar, rp.puede_eliminar, rp.puede_reporte
     FROM secciones s
     LEFT JOIN rol_permisos rp ON rp.seccion_id = s.id AND rp.rol_id = ?
     ORDER BY s.id ASC`,
    [rolId]
  );

  const out = {};
  for (const r of rows) {
    out[r.seccion] = {
      crear: Number(r.puede_crear || 0) === 1,
      editar: Number(r.puede_editar || 0) === 1,
      eliminar: Number(r.puede_eliminar || 0) === 1,
      reporte: Number(r.puede_reporte || 0) === 1
    };
  }
  res.json(out);
});

module.exports = router;
