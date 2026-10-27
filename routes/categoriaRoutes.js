const express = require('express');
const { crear, consultar, actualizar, eliminar } = require('../controllers/categoriaController');
const { autenticarUsuario, autorizarRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticarUsuario, consultar);
router.post('/', autenticarUsuario, autorizarRoles('admin'), crear);
router.patch('/:id', autenticarUsuario, autorizarRoles('admin'), actualizar);
router.delete('/:id', autenticarUsuario, autorizarRoles('admin'), eliminar);

module.exports = router;