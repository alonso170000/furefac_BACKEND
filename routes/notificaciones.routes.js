const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired } = require('../middleware/auth.js');
const { permiso } = require('../middleware/permisos.js');
const nodemailer = require('nodemailer');
const router = Router();

// ============================================
// CONFIGURACIÓN DEL TRANSPORTER DE NODemailer
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verificar conexión al iniciar
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Error al conectar con Gmail:', error.message);
  } else {
    console.log('✅ Servidor de correo listo para enviar mensajes');
  }
});

/**
 * POST /api/notificaciones/enviar-compra
 */
router.post('/enviar-compra', authRequired, permiso('cotizaciones', 'crear'), async (req, res) => {
  try {
    const { contacto_id, tipo, datos_compra } = req.body;

    if (!contacto_id || !tipo || !datos_compra) {
      return res.status(400).json({ 
        message: 'Campos requeridos: contacto_id, tipo, datos_compra' 
      });
    }

    const [contactos] = await pool.query(
      'SELECT * FROM contactos WHERE id = ?',
      [contacto_id]
    );

    if (contactos.length === 0) {
      return res.status(404).json({ message: 'Contacto no encontrado' });
    }

    const contacto = contactos[0];
    const resultados = { correo: null, sms: null };

    // Enviar correo con Gmail
    if (tipo === 'correo' || tipo === 'ambos') {
      try {
        const info = await transporter.sendMail({
          from: `"Fundación Recolectando Felicidad" <${process.env.SMTP_USER}>`,
          to: contacto.correo,
          subject: '✅ Nueva Compra Registrada - Fundación',
          html: generarHTMLCompra(datos_compra, contacto),
        });

        console.log('✅ Correo REAL enviado a:', contacto.correo);
        console.log('   ID del mensaje:', info.messageId);
        resultados.correo = 'enviado';
      } catch (error) {
        console.error('❌ Error al enviar correo:', error.message);
        resultados.correo = 'error: ' + error.message;
      }
    }

    if (tipo === 'sms' || tipo === 'ambos') {
      console.log('📱 SIMULACIÓN - SMS enviado a:', contacto.numero);
      resultados.sms = 'simulado';
    }

    // Registrar en log
    try {
      await pool.query(`
        INSERT INTO notificaciones_log 
        (contacto_id, tipo, datos_enviados, resultado, creado_en) 
        VALUES (?, ?, ?, ?, NOW())
      `, [
        contacto_id,
        tipo,
        JSON.stringify(datos_compra),
        JSON.stringify(resultados)
      ]);
    } catch (logError) {
      // Ignorar error de log
    }

    res.json({
      message: 'Notificación procesada',
      resultados,
    });

  } catch (error) {
    console.error('Error al procesar notificación:', error);
    res.status(500).json({ 
      message: 'Error al procesar notificación', 
      error: error.message 
    });
  }
});

/**
 * GET /api/notificaciones/contactos-disponibles
 */
router.get('/contactos-disponibles', authRequired, async (req, res) => {
  try {
    const [contactos] = await pool.query(`
      SELECT id, nombre, numero, correo 
      FROM contactos 
      ORDER BY nombre ASC
    `);
    res.json(contactos);
  } catch (error) {
    console.error('Error al obtener contactos:', error);
    res.status(500).json({ 
      message: 'Error al obtener contactos', 
      error: error.message 
    });
  }
});

// ============================================
// FUNCIÓN PARA GENERAR HTML DEL CORREO
// ============================================

function generarHTMLCompra(datos, contacto) {
  const {
    folio,
    cliente_nombre,
    producto_nombre,
    cantidad,
    precio_unitario_final,
    total,
    fecha_compra,
    metodo_pago,
    notas,
  } = datos;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      background: #f5f5f5;
      padding: 20px;
      margin: 0;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #ec4899, #8b5cf6); 
      color: white; 
      padding: 30px 20px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .content { 
      padding: 30px 20px; 
    }
    .info-row { 
      margin: 15px 0; 
      padding: 15px; 
      background: #f9fafb; 
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .label { 
      font-weight: bold; 
      color: #6b7280; 
    }
    .value { 
      color: #111827;
      text-align: right;
    }
    .total { 
      font-size: 28px; 
      font-weight: bold; 
      color: #10b981; 
      text-align: center; 
      margin: 30px 0;
      padding: 20px;
      background: #f0fdf4;
      border-radius: 8px;
    }
    .notas {
      margin: 20px 0;
      padding: 15px;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
    }
    .footer { 
      text-align: center; 
      padding: 20px; 
      color: #9ca3af; 
      font-size: 0.9rem;
      background: #f9fafb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Nueva Compra Registrada</h1>
      <p style="margin: 0;">Folio: <strong>${folio}</strong></p>
    </div>
    <div class="content">
      <p>Hola <strong>${contacto.nombre}</strong>,</p>
      <p>Te notificamos que se ha registrado una nueva compra:</p>
      
      <div class="info-row">
        <span class="label">Cliente:</span>
        <span class="value">${cliente_nombre}</span>
      </div>
      
      <div class="info-row">
        <span class="label">Producto:</span>
        <span class="value">${producto_nombre}</span>
      </div>
      
      <div class="info-row">
        <span class="label">Cantidad:</span>
        <span class="value">${cantidad} unidad${cantidad > 1 ? 'es' : ''}</span>
      </div>
      
      <div class="info-row">
        <span class="label">Precio unitario:</span>
        <span class="value">$${Number(precio_unitario_final).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
      </div>
      
      <div class="info-row">
        <span class="label">Fecha:</span>
        <span class="value">${new Date(fecha_compra).toLocaleDateString('es-MX')}</span>
      </div>
      
      <div class="info-row">
        <span class="label">Método de pago:</span>
        <span class="value">${metodo_pago}</span>
      </div>
      
      ${notas ? `
      <div class="notas">
        <strong>📝 Notas:</strong><br>
        ${notas}
      </div>
      ` : ''}
      
      <div class="total">
        Total: $${Number(total).toLocaleString('es-MX', {minimumFractionDigits: 2})}
      </div>
      
      <p style="color: #6b7280; font-size: 0.9rem; margin-top: 30px;">
        Esta compra ha sido registrada en el sistema de gestión de la fundación.
      </p>
    </div>
    <div class="footer">
      <p>Este es un correo automático. No responder.</p>
      <p><strong>Fundación Recolectando Felicidad A.C.</strong></p>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = router;