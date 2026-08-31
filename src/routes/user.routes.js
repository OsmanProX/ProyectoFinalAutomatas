const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

router.get('/dashboard', (req, res) => userController.getDashboard(req, res));
router.post('/toggle/:id', (req, res) => userController.toggleUserState(req, res));
router.post('/delete/:id', (req, res) => userController.deleteUser(req, res));

module.exports = router;
