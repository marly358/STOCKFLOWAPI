const express = require('express');
const { crear, consultar } = require('../controllers/categoriaController');

const router = express.Router();

router.get('/', consultar);
router.post('/', crear);

module.exports = router;