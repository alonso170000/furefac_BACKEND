// index.js
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

// Conexión (inicializa pool)
const { pool } = require('./config/config.db.js');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/categorias', require('./routes/categorias.routes'));
app.use('/api/productos', require('./routes/productos.routes'));
app.use('/api/producto-imagenes', require('./routes/productoImagenes.routes'));
app.use('/api/cotizaciones', require('./routes/cotizaciones.routes'));
app.use('/api/comentarios', require('./routes/comentarios.routes'));
app.use('/api/contactos', require('./routes/contactos.routes'));
app.use('/api/roles', require('./routes/roles.routes'));
app.use('/api/secciones', require('./routes/secciones.routes'));
app.use('/api/permisos', require('./routes/permisos.routes'));
app.use('/api/usuarios', require('./routes/usuarios.routes'));
app.use("/api", require("./routes/usuarios.roles.routes"));
app.use("/api/historial", require("./routes/historial.routes"));


const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
