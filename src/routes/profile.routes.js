const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');

// Requiere sesión (se aplica authMiddleware en app.js)
router.get('/foto', (req, res) => profileController.getAvatar(req, res));
router.get('/credencial', (req, res) => profileController.downloadCredential(req, res));

module.exports = router;
