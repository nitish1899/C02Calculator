const express = require('express');
const authController = require('../controllers/auth');
const router = express.Router();

router.post('/signup', authController.register);
router.post('/login', authController.login);
router.post('/forgotPin', authController.forgotPin);

module.exports = router;