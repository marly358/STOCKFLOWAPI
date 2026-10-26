const express = require('express');
const {
  consultarExistencias,
  registrarEntrada,
  registrarSalida,
} = require('../controllers/movimientoController');

const router = express.Router();

router.get('/existencias', consultarExistencias);
router.post('/entradas', registrarEntrada);
router.post('/salidas', registrarSalida);

module.exports = router;
