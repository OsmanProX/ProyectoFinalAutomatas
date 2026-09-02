const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/login', (req, res) => authController.getLogin(req, res));
router.post('/login', (req, res) => authController.postLogin(req, res));
router.post('/login/face', (req, res) => authController.postFaceLogin(req, res));

router.get('/register', (req, res) => authController.getRegister(req, res));
router.post('/register', (req, res) => authController.postRegister(req, res));

router.get('/logout', (req, res) => authController.logout(req, res));

router.get('/lang/:lang', (req, res) => authController.setLanguage(req, res));

module.exports = router;
