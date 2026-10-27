const express = require('express');
const {
  consultarUsuarios,
  consultarUsuarioPorId,
  actualizarUsuario,
  cambiarPassword,
  desactivarUsuario,
} = require('../controllers/userController');
const { autenticarUsuario, autorizarRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticarUsuario, autorizarRoles('admin'), consultarUsuarios);
router.get('/:id', autenticarUsuario, consultarUsuarioPorId);
router.patch('/:id', autenticarUsuario, actualizarUsuario);
router.patch('/:id/password', autenticarUsuario, cambiarPassword);
router.patch('/:id/desactivar', autenticarUsuario, autorizarRoles('admin'), desactivarUsuario);

module.exports = router;
