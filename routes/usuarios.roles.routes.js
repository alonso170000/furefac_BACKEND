// routes/usuarios.roles.routes.js
const { Router } = require("express");
const { pool } = require("../config/config.db.js");
const { authRequired } = require("../middleware/auth.js");
const { permiso } = require("../middleware/permisos.js");
const router = Router();

// Secciones (para pintar la matriz de checks)
router.get("/usuarios/secciones",
  authRequired, permiso("usuarios","reporte"),
  async (req,res)=>{
    const [rows] = await pool.query("SELECT id, nombre FROM secciones ORDER BY id");
    res.json(rows);
  }
);

// Roles
router.get("/usuarios/roles",
  authRequired, permiso("usuarios","reporte"),
  async (req,res)=>{
    const [rows] = await pool.query("SELECT id, nombre, creado_en FROM roles ORDER BY id ASC");
    res.json(rows);
  }
);

router.post("/usuarios/roles",
  authRequired, permiso("usuarios","crear"),
  async (req,res)=>{
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ message:"Nombre requerido" });
    const [result] = await pool.query("INSERT INTO roles (nombre) VALUES (?)", [nombre]);
    res.status(201).json({ id:result.insertId, message:"Rol creado" });
  }
);

router.put("/usuarios/roles/:id",
  authRequired, permiso("usuarios","editar"),
  async (req,res)=>{
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ message:"Nombre requerido" });
    await pool.query("UPDATE roles SET nombre=? WHERE id=?", [nombre, req.params.id]);
    res.json({ message:"Rol actualizado" });
  }
);

router.delete("/usuarios/roles/:id",
  authRequired, permiso("usuarios","eliminar"),
  async (req,res)=>{
    const rolId = Number(req.params.id);
    if (rolId === 1) return res.status(400).json({ message:"No se puede eliminar el rol Superadmin" });
    const [countRows] = await pool.query("SELECT COUNT(*) AS c FROM usuarios WHERE rol_id=?", [rolId]);
    const [{ c }] = countRows;
    if (c > 0) return res.status(409).json({ message:"No se puede eliminar: hay usuarios con este rol" });
    await pool.query("DELETE FROM roles WHERE id=?", [rolId]); // CASCADE borra rol_permisos
    res.json({ message:"Rol eliminado" });
  }
);

// Permisos por rol
router.get("/usuarios/roles/:id/permisos",
  authRequired, permiso("usuarios","reporte"),
  async (req,res)=>{
    const rolId = req.params.id;
    const [secciones] = await pool.query("SELECT id, nombre FROM secciones ORDER BY id");
    const [perms] = await pool.query(
      "SELECT seccion_id, puede_crear, puede_editar, puede_eliminar, puede_reporte FROM rol_permisos WHERE rol_id=?",
      [rolId]
    );
    const map = new Map(perms.map(p=>[p.seccion_id,p]));
    res.json(secciones.map(s=>({
      seccion_id: s.id,
      seccion: s.nombre,
      puede_crear:  map.get(s.id)?.puede_crear  ?? 0,
      puede_editar: map.get(s.id)?.puede_editar ?? 0,
      puede_eliminar: map.get(s.id)?.puede_eliminar ?? 0,
      puede_reporte: map.get(s.id)?.puede_reporte ?? 0,
    })));
  }
);

router.put("/usuarios/roles/:id/permisos",
  authRequired, permiso("usuarios","editar"),
  async (req,res)=>{
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
      res.json({ message:"Permisos actualizados" });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ message:"Error guardando permisos" });
    } finally {
      conn.release();
    }
  }
);

// (Opcional) borrar permisos de una sección concreta
router.delete("/usuarios/roles/:id/permisos/:seccionId",
  authRequired, permiso("usuarios","eliminar"),
  async (req,res)=>{
    await pool.query(
      "DELETE FROM rol_permisos WHERE rol_id=? AND seccion_id=?",
      [req.params.id, req.params.seccionId]
    );
    res.json({ message:"Permisos eliminados para la sección" });
  }
);

module.exports = router;
