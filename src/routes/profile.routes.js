const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');

// Requiere sesión (se aplica authMiddleware en app.js)
router.get('/', (req, res) => profileController.getPage(req, res));
router.get('/foto', (req, res) => profileController.getAvatar(req, res));
router.get('/foto/original', (req, res) => profileController.getOriginal(req, res));
router.get('/credencial', (req, res) => profileController.downloadCredential(req, res));

router.post('/foto', (req, res) => profileController.postPhoto(req, res));
router.post('/password', (req, res) => profileController.postPassword(req, res));
router.post('/credencial/nueva', (req, res) => profileController.postNewCredential(req, res));

module.exports = router;
