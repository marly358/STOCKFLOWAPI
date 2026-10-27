require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function main() {
  try {
    await connectDB();
    const resultado = await User.updateMany(
      { role: 'usuario' },
      { $set: { role: 'bodeguero' } }
    );
    console.log(`Migración completada: ${resultado.modifiedCount} cuenta(s) convertida(s) a bodeguero.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`No se pudo migrar los roles: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = main;
