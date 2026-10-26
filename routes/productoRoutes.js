const express = require('express');
const { crearProducto } = require('../controllers/productoController');

const router = express.Router();

router.post('/', crearProducto);

module.exports = router;
