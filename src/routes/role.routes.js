const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { adminOnly } = require('../middlewares/auth.middleware');

router.get('/', adminOnly, (req, res) => roleController.getRoles(req, res));
router.post('/toggle/:id', adminOnly, (req, res) => roleController.toggleActive(req, res));

module.exports = router;