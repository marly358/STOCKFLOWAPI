const express = require('express');
const {
  crearProducto,
  consultarProductos,
  consultarProductoPorId,
  actualizarProducto,
  eliminarProducto,
} = require('../controllers/productoController');
const { autenticarUsuario, autorizarRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticarUsuario, consultarProductos);
router.get('/:id', autenticarUsuario, consultarProductoPorId);
router.post('/', autenticarUsuario, autorizarRoles('admin'), crearProducto);
router.patch('/:id', autenticarUsuario, autorizarRoles('admin'), actualizarProducto);
router.delete('/:id', autenticarUsuario, autorizarRoles('admin'), eliminarProducto);

module.exports = router;
