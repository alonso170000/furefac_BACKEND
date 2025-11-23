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
    await pool.query("DELETE FROM productos WHERE id=?", [req.params.id]);
    res.json({ message:"Producto eliminado" });
  }
);

module.exports = router;
