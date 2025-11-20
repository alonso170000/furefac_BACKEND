// routes/historial.routes.js
const { Router } = require("express");
const { pool } = require("../config/config.db.js");
const { authRequired } = require("../middleware/auth.js");
const { permiso } = require("../middleware/permisos.js");

const router = Router();

router.get("/", authRequired, permiso("historial", "reporte"), async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM vw_historial_compras ORDER BY fecha DESC");
  res.json(rows);
});

router.get("/:id", authRequired, permiso("historial", "reporte"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT cv.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
     FROM cotizacion_ventas cv
     JOIN usuarios u ON u.id = cv.usuario_id
     WHERE cv.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: "Venta no encontrada" });
  res.json(rows[0]);
});

router.post("/", authRequired, permiso("historial", "crear"), async (req, res) => {
  const {
    cotizacion_id,
    folio,
    fecha_compra,
    cantidad,
    precio_unitario_final,
    total,
    metodo_pago,
    metodo_pago_otro = null,
    notas = null,
    cliente_nombre,
    cliente_correo,
    cliente_telefono,
    producto_nombre,
    producto_descripcion = null,
    producto_categoria = null,
  } = req.body;

  if (
    !cotizacion_id ||
    !folio ||
    !fecha_compra ||
    cantidad === undefined ||
    precio_unitario_final === undefined ||
    !metodo_pago ||
    !cliente_nombre ||
    !cliente_correo ||
    !cliente_telefono ||
    !producto_nombre
  ) {
    return res.status(400).json({ message: "Faltan datos obligatorios de la venta" });
  }

  const cantidadVal = Number(cantidad) > 0 ? Number(cantidad) : 1;
  const precioVal = Number(precio_unitario_final);
  if (Number.isNaN(precioVal)) {
    return res.status(400).json({ message: "precio_unitario_final inválido" });
  }
  const totalVal =
    total === undefined || total === null || total === ""
      ? cantidadVal * precioVal
      : Number(total);
  if (Number.isNaN(totalVal)) {
    return res.status(400).json({ message: "total inválido" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO cotizacion_ventas (
         cotizacion_id, usuario_id, folio, fecha_compra,
         cantidad, precio_unitario_final, total,
         metodo_pago, metodo_pago_otro, notas,
         cliente_nombre, cliente_correo, cliente_telefono,
         producto_nombre, producto_descripcion, producto_categoria
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cotizacion_id,
        req.usuario.id,
        folio,
        fecha_compra,
        cantidadVal,
        precioVal,
        totalVal,
        metodo_pago,
        metodo_pago_otro,
        notas,
        cliente_nombre,
        cliente_correo,
        cliente_telefono,
        producto_nombre,
        producto_descripcion,
        producto_categoria,
      ]
    );
    res.status(201).json({ id: result.insertId, message: "Venta registrada" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "El folio ya existe" });
    }
    res.status(500).json({ message: "Error al registrar venta", error: String(e) });
  }
});

router.put("/:id", authRequired, permiso("historial", "editar"), async (req, res) => {
  const campos = {
    cotizacion_id: req.body.cotizacion_id,
    folio: req.body.folio,
    fecha_compra: req.body.fecha_compra,
    cantidad: req.body.cantidad,
    precio_unitario_final: req.body.precio_unitario_final,
    total: req.body.total,
    metodo_pago: req.body.metodo_pago,
    metodo_pago_otro: req.body.metodo_pago_otro,
    notas: req.body.notas,
    cliente_nombre: req.body.cliente_nombre,
    cliente_correo: req.body.cliente_correo,
    cliente_telefono: req.body.cliente_telefono,
    producto_nombre: req.body.producto_nombre,
    producto_descripcion: req.body.producto_descripcion,
    producto_categoria: req.body.producto_categoria,
  };

  const sets = [];
  const values = [];
  for (const [campo, valor] of Object.entries(campos)) {
    if (valor === undefined) continue;

    if (campo === "cantidad" && valor !== null) {
      const numero = Number(valor);
      if (!Number.isFinite(numero) || numero <= 0) {
        return res.status(400).json({ message: "cantidad debe ser mayor a 0" });
      }
      sets.push("cantidad = ?");
      values.push(numero);
      continue;
    }

    if (["precio_unitario_final", "total"].includes(campo) && valor !== null) {
      const numero = Number(valor);
      if (Number.isNaN(numero)) {
        return res.status(400).json({ message: `Valor inválido para ${campo}` });
      }
      sets.push(`${campo} = ?`);
      values.push(numero);
      continue;
    }

    sets.push(`${campo} = ?`);
    values.push(valor);
  }

  if (!sets.length) {
    return res.status(400).json({ message: "No se enviaron campos para actualizar" });
  }

  const [result] = await pool.query(
    `UPDATE cotizacion_ventas SET ${sets.join(", ")} WHERE id = ?`,
    [...values, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Venta no encontrada" });
  res.json({ message: "Venta actualizada" });
});

router.delete("/:id", authRequired, permiso("historial", "eliminar"), async (req, res) => {
  const [result] = await pool.query("DELETE FROM cotizacion_ventas WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Venta no encontrada" });
  res.json({ message: "Venta eliminada" });
});

module.exports = router;
