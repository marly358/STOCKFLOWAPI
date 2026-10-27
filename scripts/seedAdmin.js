const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

function validarConfiguracion({ nombre, email, password }) {
  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    throw new Error('ADMIN_NAME debe tener al menos 2 caracteres.');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('ADMIN_EMAIL debe ser un correo válido.');
  }
  if (typeof password !== 'string' ||
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.');
  }
}

async function ensureAdmin({ nombre, email, password }) {
  validarConfiguracion({ nombre, email, password });
  const emailNormalizado = email.trim().toLowerCase();
  const administrador = await User.exists({ emailNormalizado, role: 'admin' });
  if (administrador) {
    return false;
  }

  const usuarioExistente = await User.exists({ emailNormalizado });
  if (usuarioExistente) {
    throw new Error('ADMIN_EMAIL ya está asociado a una cuenta que no es administradora.');
  }

  const user = new User({
    nombre: nombre.trim(),
    email: emailNormalizado,
    passwordHash: password,
    role: 'admin',
  });
  try {
    await user.save();
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const duplicateAdministrator = await User.exists({ emailNormalizado, role: 'admin' });
    if (duplicateAdministrator) {
      return false;
    }
    throw new Error('ADMIN_EMAIL ya está asociado a una cuenta que no es administradora.');
  }
  return true;
}

async function main() {
  require('dotenv').config();
  const config = {
    nombre: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  };
  validarConfiguracion(config);

  try {
    await connectDB();
    const creado = await ensureAdmin(config);
    console.log(creado ? 'Administrador inicial creado.' : 'El administrador inicial ya existe; no se realizaron cambios.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`No se pudo inicializar el administrador: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { ensureAdmin, validarConfiguracion };
