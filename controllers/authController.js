const jwt = require('jsonwebtoken');
const { buscarUsuarioPorEmail } = require('../services/userService');

function validarPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || ''));
}

function generarToken(usuario) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('La variable de entorno JWT_SECRET no está definida.');
  }

  return jwt.sign(
    {
      sub: usuario._id.toString(),
      email: usuario.email,
      role: usuario.role,
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

function registrarUsuario(req, res) {
  return res.status(403).json({ message: 'El registro público de usuarios está deshabilitado.' });
}

async function iniciarSesion(req, res, next) {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({
      message: 'El correo y la contraseña son obligatorios.',
    });
  }

  try {
    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario || !usuario.activo || !['admin', 'bodeguero'].includes(usuario.role)) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const passwordValida = await usuario.comparePassword(password);
    if (!passwordValida) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = generarToken(usuario);

    return res.status(200).json({
      message: 'Inicio de sesión correcto.',
      token,
      usuario,
    });
  } catch (error) {
    return next(error);
  }
}

async function obtenerPerfil(req, res) {
  const usuario = req.user;
  return res.status(200).json({ user: usuario });
}

module.exports = {
  registrarUsuario,
  iniciarSesion,
  obtenerPerfil,
  validarPassword,
};
