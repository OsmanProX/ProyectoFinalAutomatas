const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { activeRoleMiddleware } = require('../middlewares/auth.middleware');

router.get('/dashboard', (req, res) => userController.getDashboard(req, res));
router.post('/toggle/:id', activeRoleMiddleware, (req, res) => userController.toggleUserState(req, res));
router.post('/delete/:id', activeRoleMiddleware, (req, res) => userController.deleteUser(req, res));

module.exports = router;