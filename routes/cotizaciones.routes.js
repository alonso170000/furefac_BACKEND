// routes/cotizaciones.routes.js
const { Router } = require("express");
const { pool } = require("../config/config.db.js");
const { authRequired } = require("../middleware/auth.js");
const { permiso } = require("../middleware/permisos.js");

const router = Router();
const ESTADOS_COTIZACION = new Set(["pendiente", "en_seguimiento", "no_comprado", "comprado"]);

function normalizarEstado(estado) {
  if (!estado && estado !== 0) return null;
  const val = estado.toString().toLowerCase();
  return ESTADOS_COTIZACION.has(val) ? val : null;
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// Crear cotización (público)
router.post("/", async (req, res) => {
  const {
    producto_id = null,
    nombre_usuario,
    correo,
    telefono,
    descripcion,
    producto_nombre_snap = null,
    producto_precio_snap = null,
    producto_categoria_snap = null,
    producto_descripcion_snap = null,
    cantidad_solicitada = 1,
    estado = "pendiente",
  } = req.body;

  if (!nombre_usuario || !correo || !telefono || !descripcion) {
    return res.status(400).json({ message: "Campos obligatorios: nombre_usuario, correo, telefono, descripcion" });
  }

  const estadoVal = normalizarEstado(estado) ?? "pendiente";
  if (!ESTADOS_COTIZACION.has(estadoVal)) {
    return res.status(400).json({ message: "Estado inválido" });
  }

  const cantidad = Number(cantidad_solicitada) > 0 ? Number(cantidad_solicitada) : 1;
  const precioSnap = nullableNumber(producto_precio_snap);
  const productoId = nullableNumber(producto_id);

  await pool.query(
    `INSERT INTO cotizaciones
     (producto_id, nombre_usuario, correo, telefono, descripcion,
      producto_nombre_snap, producto_precio_snap, producto_categoria_snap,
      producto_descripcion_snap, cantidad_solicitada, estado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      productoId,
      nombre_usuario,
      correo,
      telefono,
      descripcion,
      producto_nombre_snap,
      precioSnap,
      producto_categoria_snap,
      producto_descripcion_snap,
      cantidad,
      estadoVal,
    ]
  );

  res.status(201).json({ message: "Cotización enviada" });
});

// Buzón (vista)
router.get("/buzon", authRequired, permiso("buzon", "reporte"), async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM vw_buzon_cotizaciones ORDER BY fecha DESC");
  res.json(rows);
});

// Listado interno detallado
router.get("/", authRequired, permiso("cotizaciones", "reporte"), async (req, res) => {
  const { estado, q, fecha_inicio, fecha_fin } = req.query;
  const where = [];
  const values = [];

  if (estado && estado !== "todos") {
    const estadoVal = normalizarEstado(estado);
    if (!estadoVal) return res.status(400).json({ message: "Estado inválido" });
    where.push("c.estado = ?");
    values.push(estadoVal);
  }

  if (q) {
    const like = `%${q}%`;
    where.push("(c.nombre_usuario LIKE ? OR c.correo LIKE ? OR c.telefono LIKE ?)");
    values.push(like, like, like);
  }

  if (fecha_inicio) {
    where.push("DATE(c.creado_en) >= ?");
    values.push(fecha_inicio);
  }
  if (fecha_fin) {
    where.push("DATE(c.creado_en) <= ?");
    values.push(fecha_fin);
  }

  const [rows] = await pool.query(
    `SELECT c.*,
            COALESCE(c.producto_nombre_snap, p.nombre) AS producto_nombre,
            COALESCE(c.producto_precio_snap, p.precio_mxn) AS producto_precio,
            COALESCE(c.producto_categoria_snap, cat.nombre) AS producto_categoria
     FROM cotizaciones c
     LEFT JOIN productos p ON p.id = c.producto_id
     LEFT JOIN categorias cat ON cat.id = p.categoria_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY c.creado_en DESC`,
    values
  );

  res.json(rows);
});

// Estado puntual
router.patch(
  "/:id/estado",
  authRequired,
  permiso("cotizaciones", "editar"),
  async (req, res) => {
    const { estado } = req.body;
    const estadoVal = normalizarEstado(estado);
    if (!estadoVal) return res.status(400).json({ message: "Estado inválido" });

    const [result] = await pool.query(
      "UPDATE cotizaciones SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
      [estadoVal, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Cotización no encontrada" });
    res.json({ message: "Estado actualizado" });
  }
);

// Imagenes de cotizacion
router.get(
  "/:id/imagenes",
  authRequired,
  permiso("cotizaciones", "reporte"),
  async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, ruta, orden, creado_en FROM cotizacion_imagenes WHERE cotizacion_id=? ORDER BY orden ASC, id ASC",
      [req.params.id]
    );
    res.json(rows);
  }
);

router.post(
  "/:id/imagenes",
  authRequired,
  permiso("cotizaciones", "editar"),
  async (req, res) => {
    const { ruta, orden = 1 } = req.body;
    if (!ruta) return res.status(400).json({ message: "ruta requerida" });
    try {
      await pool.query(
        "INSERT INTO cotizacion_imagenes (cotizacion_id, ruta, orden) VALUES (?,?,?)",
        [req.params.id, ruta, orden]
      );
      res.status(201).json({ message: "Imagen agregada" });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Ya existe imagen con ese orden" });
      res.status(500).json({ message: "Error", error: String(e) });
    }
  }
);

router.delete(
  "/imagenes/:imgId",
  authRequired,
  permiso("cotizaciones", "eliminar"),
  async (req, res) => {
    await pool.query("DELETE FROM cotizacion_imagenes WHERE id=?", [req.params.imgId]);
    res.json({ message: "Imagen eliminada" });
  }
);

// Actualización completa
router.put("/:id", authRequired, permiso("cotizaciones", "editar"), async (req, res) => {
  const {
    nombre_usuario,
    correo,
    telefono,
    descripcion,
    producto_id = undefined,
    producto_nombre_snap,
    producto_precio_snap,
    producto_categoria_snap,
    producto_descripcion_snap,
    cantidad_solicitada,
    estado,
  } = req.body;

  const fields = [];
  const values = [];

  if (nombre_usuario !== undefined) {
    fields.push("nombre_usuario = ?");
    values.push(nombre_usuario);
  }
  if (correo !== undefined) {
    fields.push("correo = ?");
    values.push(correo);
  }
  if (telefono !== undefined) {
    fields.push("telefono = ?");
    values.push(telefono);
  }
  if (descripcion !== undefined) {
    fields.push("descripcion = ?");
    values.push(descripcion);
  }
  if (producto_id !== undefined) {
    fields.push("producto_id = ?");
    values.push(nullableNumber(producto_id));
  }
  if (producto_nombre_snap !== undefined) {
    fields.push("producto_nombre_snap = ?");
    values.push(producto_nombre_snap || null);
  }
  if (producto_precio_snap !== undefined) {
    const precioVal = nullableNumber(producto_precio_snap);
    fields.push("producto_precio_snap = ?");
    values.push(precioVal);
  }
  if (producto_categoria_snap !== undefined) {
    fields.push("producto_categoria_snap = ?");
    values.push(producto_categoria_snap || null);
  }
  if (producto_descripcion_snap !== undefined) {
    fields.push("producto_descripcion_snap = ?");
    values.push(producto_descripcion_snap || null);
  }
  if (cantidad_solicitada !== undefined) {
    const cantidad = Number(cantidad_solicitada) > 0 ? Number(cantidad_solicitada) : 1;
    fields.push("cantidad_solicitada = ?");
    values.push(cantidad);
  }
  if (estado !== undefined) {
    const estadoVal = normalizarEstado(estado);
    if (!estadoVal) return res.status(400).json({ message: "Estado inválido" });
    fields.push("estado = ?");
    values.push(estadoVal);
  }

  if (!fields.length) {
    return res.status(400).json({ message: "No se enviaron campos para actualizar" });
  }

  fields.push("actualizado_en = CURRENT_TIMESTAMP");

  const [result] = await pool.query(
    `UPDATE cotizaciones SET ${fields.join(", ")} WHERE id = ?`,
    [...values, req.params.id]
  );

  if (!result.affectedRows) return res.status(404).json({ message: "Cotización no encontrada" });
  res.json({ message: "Cotización actualizada" });
});

// Detalle
router.get("/:id", authRequired, permiso("cotizaciones", "reporte"), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*,
            COALESCE(c.producto_nombre_snap, p.nombre) AS producto_nombre,
            COALESCE(c.producto_precio_snap, p.precio_mxn) AS producto_precio,
            COALESCE(c.producto_categoria_snap, cat.nombre) AS producto_categoria
     FROM cotizaciones c
     LEFT JOIN productos p ON p.id = c.producto_id
     LEFT JOIN categorias cat ON cat.id = p.categoria_id
     WHERE c.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: "Cotización no encontrada" });
  res.json(rows[0]);
});

// Eliminar (hard delete)
router.delete("/:id", authRequired, permiso("cotizaciones", "eliminar"), async (req, res) => {
  const [result] = await pool.query("DELETE FROM cotizaciones WHERE id=?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Cotización no encontrada" });
  res.json({ message: "Cotización eliminada" });
});

module.exports = router;
