// routes/productoImagenes.routes.js
const { Router } = require("express");
const { pool } = require("../config/config.db.js");
const { authRequired } = require("../middleware/auth.js");
const { permiso } = require("../middleware/permisos.js");

const router = Router();

router.get(
  "/producto/:productoId",
  authRequired,
  permiso("productos", "reporte"),
  async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, producto_id, ruta, orden, creado_en
       FROM producto_imagenes
       WHERE producto_id = ?
       ORDER BY orden ASC, id ASC`,
      [req.params.productoId]
    );
    res.json(rows);
  }
);

router.post("/", authRequired, permiso("productos", "crear"), async (req, res) => {
  const { producto_id, ruta, orden = null } = req.body;
  if (!producto_id || !ruta) {
    return res.status(400).json({ message: "producto_id y ruta son requeridos" });
  }

  let ordenFinal = Number(orden);
  if (!ordenFinal) {
    const [rows] = await pool.query(
      "SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM producto_imagenes WHERE producto_id = ?",
      [producto_id]
    );
    ordenFinal = rows[0]?.siguiente || 1;
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO producto_imagenes (producto_id, ruta, orden) VALUES (?,?,?)",
      [producto_id, ruta, ordenFinal]
    );
    res.status(201).json({ id: result.insertId, message: "Imagen registrada" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ya existe una imagen con ese orden para el producto" });
    }
    res.status(500).json({ message: "Error al guardar imagen", error: String(e) });
  }
});

router.put("/:id", authRequired, permiso("productos", "editar"), async (req, res) => {
  const { ruta, orden } = req.body;
  if (ruta === undefined && orden === undefined) {
    return res.status(400).json({ message: "Se requiere ruta u orden para actualizar" });
  }

  const fields = [];
  const values = [];
  if (ruta !== undefined) {
    fields.push("ruta = ?");
    values.push(ruta);
  }
  if (orden !== undefined) {
    const ordenVal = Number(orden);
    if (!Number.isInteger(ordenVal) || ordenVal <= 0) {
      return res.status(400).json({ message: "orden debe ser un entero positivo" });
    }
    fields.push("orden = ?");
    values.push(ordenVal);
  }

  try {
    const [result] = await pool.query(
      `UPDATE producto_imagenes SET ${fields.join(", ")} WHERE id = ?`,
      [...values, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Imagen no encontrada" });
    res.json({ message: "Imagen actualizada" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ya existe una imagen con ese orden para el producto" });
    }
    res.status(500).json({ message: "Error al actualizar imagen", error: String(e) });
  }
});

router.delete("/:id", authRequired, permiso("productos", "eliminar"), async (req, res) => {
  const [result] = await pool.query("DELETE FROM producto_imagenes WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Imagen no encontrada" });
  res.json({ message: "Imagen eliminada" });
});

module.exports = router;
