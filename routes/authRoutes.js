const express = require('express');
const { registrarUsuario, iniciarSesion, obtenerPerfil } = require('../controllers/authController');
const { autenticarUsuario } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registrarUsuario);
router.post('/login', iniciarSesion);
router.get('/me', autenticarUsuario, obtenerPerfil);

module.exports = router;
