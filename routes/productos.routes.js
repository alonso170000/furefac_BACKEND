// routes/productos.routes.js
const { Router } = require("express");
const { pool } = require("../config/config.db.js");
const { authRequired } = require("../middleware/auth.js");
const { permiso } = require("../middleware/permisos.js");
const router = Router();

// Público (listado / detalle)
router.get("/", async (req,res)=>{
  const { q, categoria_id, activo } = req.query;
  const where = [];
  const params = [];
  if (q) { where.push("p.nombre LIKE ?"); params.push(`%${q}%`); }
  if (categoria_id) { where.push("p.categoria_id=?"); params.push(categoria_id); }
  if (activo !== undefined && activo !== "") { where.push("p.activo=?"); params.push(Number(activo)); }
  const sql = `SELECT p.*,
                      c.nombre AS categoria,
                      (SELECT ruta FROM producto_imagenes pi2 WHERE pi2.producto_id = p.id ORDER BY pi2.orden ASC, pi2.id ASC LIMIT 1) AS imagen,
                      GROUP_CONCAT(pi.ruta ORDER BY pi.orden ASC, pi.id ASC SEPARATOR '||') AS imagenes
               FROM productos p
               JOIN categorias c ON c.id=p.categoria_id
               LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id
               ${where.length?`WHERE ${where.join(" AND ")}`:""}
               GROUP BY p.id
               ORDER BY p.creado_en DESC`;
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

router.get("/:id", async (req,res)=>{
  const [rows] = await pool.query("SELECT * FROM productos WHERE id=?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ message:"No encontrado" });
  res.json(rows[0]);
});

// Protegido (crear / editar / eliminar)
router.post("/",
  authRequired, permiso("productos","crear"),
  async (req,res)=>{
    const { nombre, descripcion=null, precio_mxn, categoria_id, activo=1 } = req.body;
    if (!nombre || precio_mxn==null || !categoria_id) {
      return res.status(400).json({ message:"nombre, precio_mxn, categoria_id son requeridos" });
    }
    const [result] = await pool.query(
      "INSERT INTO productos (nombre, descripcion, precio_mxn, categoria_id, activo) VALUES (?,?,?,?,?)",
      [nombre, descripcion, precio_mxn, categoria_id, activo]
    );
    res.status(201).json({ id:result.insertId, message:"Producto creado" });
  }
);

router.put("/:id",
  authRequired, permiso("productos","editar"),
  async (req,res)=>{
    const { nombre, descripcion, precio_mxn, categoria_id, activo } = req.body;
    await pool.query(
      `UPDATE productos
       SET nombre=COALESCE(?,nombre),
           descripcion=COALESCE(?,descripcion),
           precio_mxn=COALESCE(?,precio_mxn),
           categoria_id=COALESCE(?,categoria_id),
           activo=COALESCE(?,activo)
       WHERE id=?`,
      [nombre, descripcion, precio_mxn, categoria_id, activo, req.params.id]
    );
    res.json({ message:"Producto actualizado" });
  }
);

router.delete("/:id",
  authRequired, permiso("productos","eliminar"),
  async (req,res)=>{
    const productoId = req.params.id;

    // Revisar relaciones antes de eliminar
    const [relRows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN c.estado IN ('pendiente','en_seguimiento') THEN 1 ELSE 0 END),0) AS cot_pendientes,
         COALESCE(SUM(CASE WHEN c.estado = 'no_comprado' THEN 1 ELSE 0 END),0) AS cot_no_comprado,
         COALESCE(SUM(CASE WHEN c.estado = 'comprado' THEN 1 ELSE 0 END),0) AS cot_comprado,
         COALESCE(SUM(CASE WHEN cv.id IS NOT NULL THEN 1 ELSE 0 END),0) AS ventas
       FROM cotizaciones c
       LEFT JOIN cotizacion_ventas cv ON cv.cotizacion_id = c.id
       WHERE c.producto_id = ?`,
      [productoId]
    );

    const rel = relRows?.[0] || {};
    const tieneVentas = Number(rel.ventas || 0) > 0 || Number(rel.cot_comprado || 0) > 0;
    if (tieneVentas) {
      return res.status(409).json({
        message: "No se puede eliminar el producto porque tiene compras o cotizaciones marcadas como compradas. Desactivalo.",
      });
    }

    // Cerrar cotizaciones abiertas y quitar la FK antes de eliminar
    await pool.query(
      `UPDATE cotizaciones
       SET estado = 'no_comprado', producto_id = NULL, actualizado_en = CURRENT_TIMESTAMP
       WHERE producto_id = ? AND estado IN ('pendiente','en_seguimiento','no_comprado')`,
      [productoId]
    );

    await pool.query("DELETE FROM productos WHERE id=?", [productoId]);
    res.json({ message:"Producto eliminado" });
  }
);

// Relaciones (cotizaciones / ventas) para un producto
router.get("/:id/relaciones",
  authRequired, permiso("productos","reporte"),
  async (req, res) => {
    const productoId = req.params.id;

    const [prodRows] = await pool.query("SELECT id, activo FROM productos WHERE id = ?", [productoId]);
    if (!prodRows.length) return res.status(404).json({ message: "Producto no encontrado" });

    const [rows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN c.estado IN ('pendiente','en_seguimiento') THEN 1 ELSE 0 END),0) AS cot_pendientes,
         COALESCE(SUM(CASE WHEN c.estado = 'no_comprado' THEN 1 ELSE 0 END),0) AS cot_no_comprado,
         COALESCE(SUM(CASE WHEN c.estado = 'comprado' THEN 1 ELSE 0 END),0) AS cot_comprado,
         COALESCE(SUM(CASE WHEN cv.id IS NOT NULL THEN 1 ELSE 0 END),0) AS ventas
       FROM cotizaciones c
       LEFT JOIN cotizacion_ventas cv ON cv.cotizacion_id = c.id
       WHERE c.producto_id = ?`,
      [productoId]
    );

    const stats = rows?.[0] || {};
    res.json({
      activo: prodRows[0].activo,
      cot_pendientes: Number(stats.cot_pendientes || 0),
      cot_no_comprado: Number(stats.cot_no_comprado || 0),
      cot_comprado: Number(stats.cot_comprado || 0),
      ventas: Number(stats.ventas || 0),
    });
  }
);

// Cerrar cotizaciones abiertas de un producto (marcarlas como no_comprado y desvincular producto)
router.post("/:id/cerrar-cotizaciones",
  authRequired, permiso("productos","editar"),
  async (req, res) => {
    const productoId = req.params.id;
    const [prodRows] = await pool.query("SELECT id FROM productos WHERE id = ?", [productoId]);
    if (!prodRows.length) return res.status(404).json({ message: "Producto no encontrado" });

    const [result] = await pool.query(
      `UPDATE cotizaciones
       SET estado = 'no_comprado', producto_id = NULL, actualizado_en = CURRENT_TIMESTAMP
       WHERE producto_id = ? AND estado IN ('pendiente','en_seguimiento','no_comprado')`,
      [productoId]
    );

    res.json({ message: "Cotizaciones cerradas", afectadas: result.affectedRows || 0 });
  }
);

module.exports = router;
