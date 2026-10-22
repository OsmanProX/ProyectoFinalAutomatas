const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const auditController = require('../controllers/audit.controller');
const { activeRoleMiddleware, adminOnly, menuPermissionMiddleware } = require('../middlewares/auth.middleware');

router.get('/', menuPermissionMiddleware('usuarios'), (req, res) => userController.getUsers(req, res));
router.get('/dashboard', (req, res) => userController.getDashboard(req, res));
// Bitácora de accesos (auditoría de login), solo ADMIN
router.get('/bitacora', adminOnly, (req, res) => auditController.getPage(req, res));
router.post('/toggle/:id', activeRoleMiddleware, (req, res) => userController.toggleUserState(req, res));
router.post('/delete/:id', activeRoleMiddleware, (req, res) => userController.deleteUser(req, res));
router.post('/:id/role', adminOnly, (req, res) => userController.updateRole(req, res));

module.exports = router;
