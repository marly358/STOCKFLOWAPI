const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const newman = require('newman');

const collectionPath = path.join(
  __dirname,
  '..',
  'postman',
  'collections',
  'stockflowapi.postman_collection.json'
);
const environmentPath = path.join(
  __dirname,
  '..',
  'postman',
  'environments',
  'local.postman_environment.json'
);

function getEnvironmentValue(environment, key) {
  return environment.values.find((value) => value.key === key)?.value;
}

function setEnvironmentValue(environment, key, value) {
  const existing = environment.values.find((entry) => entry.key === key);
  if (existing) {
    existing.value = value;
    existing.enabled = true;
    return;
  }
  environment.values.push({ key, value, enabled: true });
}

function requireValue(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Falta configurar la variable requerida ${name}.`);
  }
  return value.trim();
}

function validateCredentials(environment) {
  const email = requireValue(
    process.env.POSTMAN_ADMIN_EMAIL || process.env.ADMIN_EMAIL,
    'POSTMAN_ADMIN_EMAIL o ADMIN_EMAIL'
  );
  const password = requireValue(
    process.env.POSTMAN_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD,
    'POSTMAN_ADMIN_PASSWORD o ADMIN_PASSWORD'
  );
  const bodegueroPassword = requireValue(
    process.env.POSTMAN_BODEGUERO_PASSWORD ||
      getEnvironmentValue(environment, 'bodegueroPassword'),
    'POSTMAN_BODEGUERO_PASSWORD o bodegueroPassword del entorno Postman'
  );

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo configurado para las pruebas Newman no es válido.');
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    throw new Error('La contraseña configurada para las pruebas Newman no cumple los requisitos.');
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(bodegueroPassword)) {
    throw new Error('La contraseña fixture de bodeguero no cumple los requisitos.');
  }

  return {
    email,
    password,
    bodegueroPassword,
    nombre: process.env.ADMIN_NAME || 'Administrador Newman',
  };
}

function runNewman(collection, environment) {
  return new Promise((resolve, reject) => {
    newman.run(
      {
        collection,
        environment,
        reporters: [],
      },
      (error, summary) => {
        if (error) {
          reject(new Error('Newman no pudo completar la colección.'));
          return;
        }

        const run = summary.run;
        const failures = run.failures || [];
        console.log(
          `Newman: ${run.stats.requests.total} solicitudes, ` +
            `${run.stats.assertions.total} aserciones, ${failures.length} fallidas.`
        );

        for (const failure of failures) {
          const requestName = failure.source && failure.source.name;
          console.error(`Falló una prueba de Newman${requestName ? `: ${requestName}` : '.'}`);
        }

        if (failures.length > 0) {
          reject(new Error('La colección de Newman reportó pruebas fallidas.'));
          return;
        }
        resolve();
      }
    );
  });
}

function validateCiDatabaseUri(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGO_URI de CI no tiene un formato válido.');
  }

  const database = parsed.pathname.replace(/^\/+/, '');
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    database !== 'stockflow_test' ||
    parsed.searchParams.get('replicaSet') !== 'rs0'
  ) {
    throw new Error('Las pruebas CI solo pueden usar el replica set local stockflow_test.');
  }
}

async function runCi(collection, environment, credentials) {
  validateCiDatabaseUri(requireValue(process.env.MONGO_URI, 'MONGO_URI'));
  requireValue(process.env.JWT_SECRET, 'JWT_SECRET');

  const baseUrl = process.env.POSTMAN_BASE_URL || 'http://127.0.0.1:3000';
  if (baseUrl !== 'http://127.0.0.1:3000') {
    throw new Error('Las pruebas CI solo pueden apuntar a la API local de CI.');
  }

  setEnvironmentValue(environment, 'baseUrl', baseUrl);
  setEnvironmentValue(environment, 'adminEmail', credentials.email);
  setEnvironmentValue(environment, 'adminPassword', credentials.password);
  setEnvironmentValue(environment, 'bodegueroPassword', credentials.bodegueroPassword);
  await runNewman(collection, environment);
}

async function runLocal(collection, environment, credentials) {
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let httpServer;
  let disconnectDB;

  try {
    process.env.MONGO_URI = replSet.getUri('stockflow_postman_test');
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.PORT = '0';

    const connectDB = require('../config/db');
    disconnectDB = connectDB.disconnect;
    const { ensureAdmin } = require('./seedAdmin');
    await connectDB();
    await ensureAdmin(credentials);

    const app = require('../server');
    httpServer = await new Promise((resolve, reject) => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
      server.once('error', reject);
    });

    const address = httpServer.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    setEnvironmentValue(environment, 'baseUrl', baseUrl);
    setEnvironmentValue(environment, 'adminEmail', credentials.email);
    setEnvironmentValue(environment, 'adminPassword', credentials.password);
    setEnvironmentValue(environment, 'bodegueroPassword', credentials.bodegueroPassword);
    await runNewman(collection, environment);
  } finally {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (disconnectDB) {
      await disconnectDB();
    }
    await replSet.stop();
  }
}

async function main() {
  const isCiTarget = process.env.POSTMAN_TARGET === 'ci';
  if (!isCiTarget) {
    require('dotenv').config({ quiet: true });
  }

  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));
  const credentials = validateCredentials(environment);

  if (isCiTarget) {
    await runCi(collection, environment, credentials);
    return;
  }

  await runLocal(collection, environment, credentials);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
