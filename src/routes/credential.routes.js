const express = require('express');
const router = express.Router();
const credentialService = require('../services/credential.service');
const { verifySignedToken } = require('../utils/crypto');

/**
 * GET /credencial/publica/:token
 * Enlace FIRMADO y TEMPORAL (2 horas) que usa WhatsApp/Twilio para descargar el PDF.
 * No requiere sesión, pero sin una firma válida no entrega nada.
 */
router.get('/publica/:token', async (req, res) => {
  try {
    const userId = verifySignedToken(req.params.token);
    if (!userId) return res.status(404).send('Enlace inválido o vencido');
    const result = await credentialService.buildPdfForUser(userId);
    if (!result) return res.status(404).send('Enlace inválido o vencido');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="credencial-${result.code}.pdf"`,
      'Cache-Control': 'no-store'
    });
    return res.send(result.pdf);
  } catch (err) {
    console.error('Error en credencial pública:', err.message);
    return res.status(500).send('Error del servidor');
  }
});

module.exports = router;
