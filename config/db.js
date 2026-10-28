const mongoose = require('mongoose');

/**
 * Elimina de un mensaje cualquier referencia a la cadena de conexión o a las
 * credenciales, para que nunca se impriman en logs ni en la salida del servidor.
 */
function maskCredentials(message = '') {
  const uri = process.env.MONGO_URI;
  let safe = String(message);

  if (uri) {
    safe = safe.split(uri).join('[MONGO_URI oculta]');
  }

  // Enmascara usuario:password@ aunque aparezca una porción de la cadena.
  return safe.replace(/\/\/[^/@\s]+:[^/@\s]+@/g, '//[credenciales ocultas]@');
}

let connectedOnce = false;
let disconnectingIntentionally = false;

/**
 * Establece la conexión con MongoDB.
 *
 * La cadena de conexión se toma exclusivamente de la variable de entorno
 * MONGO_URI; nunca se escribe en el código fuente ni se versiona.
 *
 * Configuración local (fuera del repositorio), por ejemplo en PowerShell:
 *   $env:MONGO_URI = "mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/stockflow"
 *   npm start
 *
 * @returns {Promise<import('mongoose').Connection>} conexión activa
 * @throws {Error} si MONGO_URI no está definida o si la conexión falla
 */

async function connectDB() {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    throw new Error(
      'La variable de entorno MONGO_URI no está definida. ' +
        'Defínela localmente (fuera del repositorio) con la cadena de conexión de MongoDB Atlas.'
    );
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('Conexión con MongoDB establecida correctamente.');
    connectedOnce = true;
    return mongoose.connection;
  } catch (error) {
    throw new Error(`No se pudo conectar con MongoDB: ${maskCredentials(error.message)}`);
  }
}

async function disconnectDB() {
  disconnectingIntentionally = true;
  try {
    await mongoose.disconnect();
  } finally {
    connectedOnce = false;
    disconnectingIntentionally = false;
  }
}

// Eventos posteriores a la conexión inicial: se reportan sin interrumpir el proceso.
// Solo aplican si la primera conexión fue exitosa (evita duplicar el error de arranque).
mongoose.connection.on('error', (error) => {
  if (!connectedOnce || disconnectingIntentionally) return;
  console.error('Error en la conexión con MongoDB:', maskCredentials(error.message));
});

mongoose.connection.on('disconnected', () => {
  if (!connectedOnce || disconnectingIntentionally) return;
  console.warn('Conexión con MongoDB perdida.');
});

connectDB.disconnect = disconnectDB;

module.exports = connectDB;
