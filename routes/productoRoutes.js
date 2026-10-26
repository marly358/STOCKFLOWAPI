const express = require('express');
const { crearProducto, consultarProductos } = require('../controllers/productoController');

const router = express.Router();

router.get('/', consultarProductos);
router.post('/', crearProducto);

module.exports = router;
