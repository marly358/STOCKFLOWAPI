const express = require('express');
const {
  crearProducto,
  consultarProductos,
  actualizarProducto,
  eliminarProducto,
} = require('../controllers/productoController');

const router = express.Router();

router.get('/', consultarProductos);
router.post('/', crearProducto);
router.patch('/:id', actualizarProducto);
router.delete('/:id', eliminarProducto);

module.exports = router;
