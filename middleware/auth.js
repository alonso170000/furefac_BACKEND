// middleware/auth.js
const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Token requerido' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, usuario, rol_id, rol }  ← incluye 'rol' (nombre)
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// ✅ compara por NOMBRE (coincide con allowRoles('superadmin','admin'))
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'Permisos insuficientes' });
    }
    next();
  };
}

module.exports = { authRequired, allowRoles };
