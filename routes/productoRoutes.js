const express = require('express');
const {
  crearProducto,
  consultarProductos,
  actualizarProducto,
} = require('../controllers/productoController');

const router = express.Router();

router.get('/', consultarProductos);
router.post('/', crearProducto);
router.patch('/:id', actualizarProducto);

module.exports = router;
