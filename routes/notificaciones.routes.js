// ============================================
// Backend: routes/notificaciones.routes.js
// Sistema de notificaciones para contactos (SIN NODEMAILER - TEMPORAL)
// ============================================

const { Router } = require('express');
const { pool } = require('../config/config.db.js');
const { authRequired } = require('../middleware/auth.js');
const { permiso } = require('../middleware/permisos.js');
const router = Router();

/**
 * POST /api/notificaciones/enviar-compra
 * Enviar notificación de compra registrada a un contacto
 */
router.post('/enviar-compra', authRequired, permiso('cotizaciones', 'crear'), async (req, res) => {
  try {
    const {
      contacto_id,
      tipo,
      datos_compra,
    } = req.body;

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
    const resultados = {
      correo: null,
      sms: null,
    };

    // TEMPORAL: Simular envío de correo
    if (tipo === 'correo' || tipo === 'ambos') {
      console.log('📧 SIMULACIÓN - Correo enviado a:', contacto.correo);
      console.log('Datos de la compra:', JSON.stringify(datos_compra, null, 2));
      resultados.correo = 'simulado (nodemailer no instalado)';
    }

    if (tipo === 'sms' || tipo === 'ambos') {
      console.log('📱 SIMULACIÓN - SMS enviado a:', contacto.numero);
      resultados.sms = 'simulado';
    }

    // Registrar en log (opcional)
    await pool.query(`
      INSERT INTO notificaciones_log 
      (contacto_id, tipo, datos_enviados, resultado, creado_en) 
      VALUES (?, ?, ?, ?, NOW())
    `, [
      contacto_id,
      tipo,
      JSON.stringify(datos_compra),
      JSON.stringify(resultados)
    ]).catch(() => {
      // Si no existe la tabla, ignorar
    });

    res.json({
      message: 'Notificación procesada (modo simulación)',
      resultados,
      nota: 'El correo NO se envió realmente. Solo simulación. Verifica la consola del backend.'
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
 * Listar contactos disponibles para notificar
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

module.exports = router;