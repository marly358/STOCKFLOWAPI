const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getTokenFromHeader(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function autenticarUsuario(req, res, next) {
  const token = getTokenFromHeader(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticación requerido.' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ message: 'La variable de entorno JWT_SECRET no está definida.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado.' });
    }

    return res.status(401).json({ message: 'Token inválido.' });
  }

  if (!payload || typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !mongoose.isObjectIdOrHexString(payload.sub)) {
    return res.status(401).json({ message: 'Token inválido.' });
  }

  try {
    const usuario = await User.findById(payload.sub).lean();

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ message: 'Usuario no encontrado o inactivo.' });
    }
    if (!['admin', 'bodeguero'].includes(usuario.role)) {
      return res.status(401).json({ message: 'El rol de usuario no es válido; ejecute la migración de roles.' });
    }

    req.user = {
      id: usuario._id.toString(),
      email: usuario.email,
      role: usuario.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function autorizarRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Debe autenticarse para acceder a este recurso.' });
    }

    if (!rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permisos suficientes para esta operación.' });
    }

    return next();
  };
}

module.exports = {
  autenticarUsuario,
  autorizarRoles,
};
