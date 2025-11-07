// middleware/permisos.js
const { pool } = require("../config/config.db.js");

/**
 * Verifica si el usuario autenticado tiene permiso en la sección/acción.
 * Acciones válidas: 'crear' | 'editar' | 'eliminar' | 'reporte'
 * Usa tablas: roles, secciones, rol_permisos
 */
function permiso(seccionNombre, accion) {
  const columna = {
    crear: "puede_crear",
    editar: "puede_editar",
    eliminar: "puede_eliminar",
    reporte: "puede_reporte",
  }[accion];

  if (!columna) {
    throw new Error(`Acción no válida: ${accion}`);
  }

  return async function permisoMiddleware(req, res, next) {
    try {
      const usuario = req.usuario; // lo setea authRequired (JWT), debe traer rol_id y opcionalmente rol_nombre
      if (!usuario) return res.status(401).json({ message: "No autenticado" });

      // Bypass para Superadmin (opcional pero práctico)
      if (usuario.rol_nombre === "Superadmin" || usuario.rol_id === 1) {
        return next();
      }

      const rows = await pool.query(
        `SELECT rp.${columna} AS permitido
         FROM rol_permisos rp
         JOIN secciones s ON s.id = rp.seccion_id
         WHERE rp.rol_id = ? AND s.nombre = ?`,
        [usuario.rol_id, seccionNombre]
      );

      const permitido = rows[0]?.permitido === 1;
      if (!permitido) {
        return res.status(403).json({ message: "Permiso denegado" });
      }

      next();
    } catch (err) {
      console.error("permiso middleware error:", err);
      res.status(500).json({ message: "Error verificando permisos" });
    }
  };
}

module.exports = { permiso };
