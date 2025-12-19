// middleware/permisos.js
const { pool } = require("../config/config.db.js");

function permiso(seccionNombre, accion) {
  const col = { crear:"puede_crear", editar:"puede_editar", eliminar:"puede_eliminar", reporte:"puede_reporte" }[accion];
  if (!col) throw new Error(`Acción no válida: ${accion}`);

  return async (req, res, next) => {
    try {
      const u = req.usuario;
      if (!u) return res.status(401).json({ message:"No autenticado" });

      // Bypass Superadmin
      if (u.rol_id === 1 || u.rol_nombre === "Superadmin") return next();

      const [rows] = await pool.query(
        `SELECT rp.${col} AS ok
         FROM rol_permisos rp
         JOIN secciones s ON s.id = rp.seccion_id
         WHERE rp.rol_id=? AND s.nombre=?`,
        [u.rol_id, seccionNombre]
      );
      if (rows[0]?.ok === 1) return next();
      return res.status(403).json({ message:"Permiso denegado" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message:"Error verificando permisos" });
    }
  };
}

module.exports = { permiso };
