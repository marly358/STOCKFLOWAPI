const jwt = require('jsonwebtoken');
const { crearUsuario, buscarUsuarioPorEmail } = require('../services/userService');

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

function validarDatosRegistro(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return ['El cuerpo de la solicitud debe ser un objeto JSON.'];
  }

  const errores = [];

  if (typeof datos.nombre !== 'string' || datos.nombre.trim().length < 2) {
    errores.push('El nombre es obligatorio y debe tener al menos 2 caracteres.');
  }

  if (typeof datos.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    errores.push('El correo no tiene un formato válido.');
  }

  if (!validarPassword(datos.password)) {
    errores.push('La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas y números.');
  }

  if (datos.role && datos.role !== 'usuario') {
    errores.push('No está permitido asignar roles privilegiados durante el registro.');
  }

  return errores;
}

async function registrarUsuario(req, res, next) {
  const errores = validarDatosRegistro(req.body);
  if (errores.length > 0) {
    return res.status(400).json({
      message: 'Los datos del usuario no son válidos.',
      errors: errores,
    });
  }

  try {
    const emailExistente = await buscarUsuarioPorEmail(req.body.email);
    if (emailExistente) {
      return res.status(409).json({ message: 'Ya existe un usuario registrado con ese correo.' });
    }

    const usuario = await crearUsuario({
      nombre: req.body.nombre,
      email: req.body.email,
      password: req.body.password,
      role: 'usuario',
    });

    return res.status(201).json({
      message: 'Usuario registrado correctamente.',
      usuario,
    });
  } catch (error) {
    if (error.code === 11000 || error.name === 'MongoServerError') {
      return res.status(409).json({ message: 'Ya existe un usuario registrado con ese correo.' });
    }

    return next(error);
  }
}

async function iniciarSesion(req, res, next) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      message: 'El correo y la contraseña son obligatorios.',
    });
  }

  try {
    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario || !usuario.activo) {
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
