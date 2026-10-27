const mongoose = require('mongoose');
const {
  listarUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuarioPorId,
  cambiarPasswordPorId,
  desactivarUsuarioPorId,
} = require('../services/userService');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

function validarPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || ''));
}

function validarDatosActualizacion(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return ['El cuerpo de la solicitud debe ser un objeto JSON.'];
  }

  const errores = [];
  const camposPermitidos = ['nombre', 'email'];
  const camposDesconocidos = Object.keys(datos).filter((campo) => !camposPermitidos.includes(campo));

  if (camposDesconocidos.length > 0) {
    errores.push(`Campos no permitidos: ${camposDesconocidos.join(', ')}.`);
  }

  if (datos.nombre !== undefined && (typeof datos.nombre !== 'string' || datos.nombre.trim().length < 2)) {
    errores.push('El nombre debe tener al menos 2 caracteres.');
  }

  if (datos.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    errores.push('El correo no tiene un formato válido.');
  }

  return errores;
}

async function consultarUsuarios(req, res, next) {
  try {
    const usuarios = await listarUsuarios();
    return res.status(200).json(usuarios);
  } catch (error) {
    return next(error);
  }
}

async function consultarUsuarioPorId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'El identificador del usuario no es válido.' });
  }

  try {
    const usuario = await obtenerUsuarioPorId(req.params.id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'No tienes permisos para consultar este usuario.' });
    }

    return res.status(200).json(usuario);
  } catch (error) {
    return next(error);
  }
}

async function actualizarUsuario(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'El identificador del usuario no es válido.' });
  }

  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ message: 'No tienes permisos para modificar este usuario.' });
  }

  const errores = validarDatosActualizacion(req.body);
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length === 0) {
    errores.push('Debe enviar al menos un campo para actualizar.');
  }

  if (errores.length > 0) {
    return res.status(400).json({
      message: 'Los datos del usuario no son válidos.',
      errors: errores,
    });
  }

  try {
    const usuario = await actualizarUsuarioPorId(req.params.id, req.body);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.status(200).json({
      message: 'Usuario actualizado correctamente.',
      usuario,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese correo.' });
    }

    return next(error);
  }
}

async function cambiarPassword(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'El identificador del usuario no es válido.' });
  }

  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ message: 'No tienes permisos para cambiar la contraseña de este usuario.' });
  }

  const { currentPassword, newPassword } = req.body || {};
  const requierePasswordActual = req.user.role !== 'admin' || req.user.id === req.params.id;

  if (requierePasswordActual && !currentPassword) {
    return res.status(400).json({ message: 'La contraseña actual es obligatoria.' });
  }

  if (!newPassword) {
    return res.status(400).json({ message: 'La nueva contraseña es obligatoria.' });
  }

  if (!validarPassword(newPassword)) {
    return res.status(400).json({
      message: 'La nueva contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas y números.',
    });
  }

  try {
    const usuario = await User.findById(req.params.id).select('+passwordHash');
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (requierePasswordActual && !(await bcrypt.compare(currentPassword, usuario.passwordHash))) {
      return res.status(401).json({ message: 'La contraseña actual es incorrecta.' });
    }

    const actualizado = await cambiarPasswordPorId(req.params.id, newPassword);
    return res.status(200).json({
      message: 'Contraseña actualizada correctamente.',
      usuario: actualizado,
    });
  } catch (error) {
    return next(error);
  }
}

async function desactivarUsuario(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'El identificador del usuario no es válido.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Solo un administrador puede desactivar cuentas.' });
  }

  const { activo } = req.body || { activo: false };

  try {
    const usuario = await desactivarUsuarioPorId(req.params.id, Boolean(activo));
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.status(200).json({
      message: 'Estado del usuario actualizado correctamente.',
      usuario,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  consultarUsuarios,
  consultarUsuarioPorId,
  actualizarUsuario,
  cambiarPassword,
  desactivarUsuario,
};
