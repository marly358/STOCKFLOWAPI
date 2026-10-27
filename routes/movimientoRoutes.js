const express = require('express');
const {
  consultarExistencias,
  consultarMovimientos,
  registrarEntrada,
  registrarSalida,
} = require('../controllers/movimientoController');
const { autenticarUsuario, autorizarRoles } = require('../middleware/auth');

const router = express.Router();

router.use(autenticarUsuario);
router.get('/existencias', consultarExistencias);
router.get('/movimientos', consultarMovimientos);
router.post('/entradas', autorizarRoles('admin', 'bodeguero'), registrarEntrada);
router.post('/salidas', autorizarRoles('admin', 'bodeguero'), registrarSalida);

module.exports = router;
