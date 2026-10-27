const User = require('../models/User');

const camposPermitidos = ['nombre', 'email'];

async function crearUsuario(datos) {
  const usuario = new User({
    nombre: datos.nombre,
    email: datos.email,
    passwordHash: datos.password,
    role: 'bodeguero',
  });

  await usuario.save();
  return usuario.toJSON();
}

async function buscarUsuarioPorEmail(email) {
  const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return User.findOne({ emailNormalizado }).select('+passwordHash +emailNormalizado');
}

async function listarUsuarios() {
  return User.find({}).lean();
}

async function obtenerUsuarioPorId(id) {
  return User.findById(id).lean();
}

async function actualizarUsuarioPorId(id, datos) {
  const actualizacion = {};

  for (const campo of camposPermitidos) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) {
      actualizacion[campo] = datos[campo];
    }
  }

  if (actualizacion.email) {
    actualizacion.emailNormalizado = actualizacion.email.trim().toLowerCase();
  }

  if (Object.keys(actualizacion).length === 0) {
    return null;
  }

  return User.findByIdAndUpdate(id, actualizacion, {
    returnDocument: 'after',
    runValidators: true,
  });
}

async function cambiarPasswordPorId(id, nuevaPassword) {
  const usuario = await User.findById(id);
  if (!usuario) {
    return null;
  }

  usuario.passwordHash = nuevaPassword;
  await usuario.save();
  return usuario.toJSON();
}

async function desactivarUsuarioPorId(id, activo) {
  if (typeof activo !== 'boolean') {
    throw new TypeError('El estado activo debe ser booleano.');
  }

  return User.findByIdAndUpdate(
    id,
    { activo },
    { returnDocument: 'after', runValidators: true }
  );
}

module.exports = {
  crearUsuario,
  buscarUsuarioPorEmail,
  listarUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuarioPorId,
  cambiarPasswordPorId,
  desactivarUsuarioPorId,
};
