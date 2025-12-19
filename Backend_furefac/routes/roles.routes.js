const { Router } = require("express");
const { pool } = require("../config/config.db.js");
const { authRequired } = require("../middleware/auth.js");
const { permiso } = require("../middleware/permisos.js");
const router = Router();

// Listar roles
router.get("/roles",
  authRequired,
  permiso("configuracion","reporte"), // o el que definas para gestionar roles
  async (req, res) => {
    const [rows] = await pool.query("SELECT id, nombre, creado_en FROM roles ORDER BY id ASC");
    res.json(rows);
  }
);

// Crear rol
router.post("/roles",
  authRequired,
  permiso("configuracion","crear"),
  async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ message: "Nombre requerido" });
    const [result] = await pool.query("INSERT INTO roles (nombre) VALUES (?)", [nombre]);
    res.status(201).json({ id: result.insertId, message: "Rol creado" });
  }
);

// Obtener permisos de un rol (todas las secciones)
router.get("/roles/:id/permisos",
  authRequired,
  permiso("configuracion","reporte"),
  async (req, res) => {
    const rolId = req.params.id;
    const [secciones] = await pool.query("SELECT id, nombre FROM secciones ORDER BY id");
    const [perms] = await pool.query(
      "SELECT seccion_id, puede_crear, puede_editar, puede_eliminar, puede_reporte FROM rol_permisos WHERE rol_id=?",
      [rolId]
    );
    // Mapear por seccion
    const mapa = new Map(perms.map(p => [p.seccion_id, p]));
    const resultado = secciones.map(s => ({
      seccion_id: s.id,
      seccion: s.nombre,
      puede_crear: mapa.get(s.id)?.puede_crear ?? 0,
      puede_editar: mapa.get(s.id)?.puede_editar ?? 0,
      puede_eliminar: mapa.get(s.id)?.puede_eliminar ?? 0,
      puede_reporte: mapa.get(s.id)?.puede_reporte ?? 0,
    }));
    res.json(resultado);
  }
);

// Upsert permisos de un rol (recibe arreglo)
router.put("/roles/:id/permisos",
  authRequired,
  permiso("configuracion","editar"),
  async (req, res) => {
    const rolId = req.params.id;
    const lista = Array.isArray(req.body) ? req.body : [];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const p of lista) {
        await conn.query(
          `INSERT INTO rol_permisos (rol_id, seccion_id, puede_crear, puede_editar, puede_eliminar, puede_reporte)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             puede_crear=VALUES(puede_crear),
             puede_editar=VALUES(puede_editar),
             puede_eliminar=VALUES(puede_eliminar),
             puede_reporte=VALUES(puede_reporte)`,
          [rolId, p.seccion_id, p.puede_crear|0, p.puede_editar|0, p.puede_eliminar|0, p.puede_reporte|0]
        );
      }
      await conn.commit();
      res.json({ message: "Permisos actualizados" });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ message: "Error guardando permisos" });
    } finally {
      conn.release();
    }
  }
);

module.exports = router;
