const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('../../config/db');
const app = require('../../server');
const User = require('../../models/User');
const { ensureAdmin } = require('../../scripts/seedAdmin');

jest.setTimeout(60000);

let mongoServer;

async function crearUsuario(role, email, nombre = 'Usuario de prueba') {
  const usuario = new User({
    nombre,
    email,
    passwordHash: 'ClaveSegura123',
    role,
  });
  await usuario.save();
  return usuario;
}

async function login(email, password = 'ClaveSegura123') {
  return request(app).post('/api/auth/login').send({ email, password });
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-jwt';
  process.env.JWT_EXPIRES_IN = '1h';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('stockflow-test');
  await connectDB();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('API de autenticación y usuarios', () => {
  it('bloquea el registro público y no crea cuentas', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Ana Gómez',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      });

    expect(response.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  it('permite al administrador crear bodegueros, sin aceptar un rol del cliente', async () => {
    const admin = await crearUsuario('admin', 'admin@example.com', 'Administradora');
    const adminToken = (await login(admin.email)).body.token;

    const escalacion = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Bodeguero',
        email: 'bodeguero@example.com',
        password: 'ClaveSegura123',
        role: 'admin',
      });
    expect(escalacion.status).toBe(400);

    const creado = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Bodeguero',
        email: 'bodeguero@example.com',
        password: 'ClaveSegura123',
      });
    expect(creado.status).toBe(201);
    expect(creado.body.usuario.role).toBe('bodeguero');
    expect(creado.body.usuario).not.toHaveProperty('passwordHash');

    const persisted = await User.findOne({ email: 'bodeguero@example.com' }).select('+passwordHash');
    expect(persisted.role).toBe('bodeguero');
    expect(persisted.passwordHash).not.toBe('ClaveSegura123');
    expect(await bcrypt.compare('ClaveSegura123', persisted.passwordHash)).toBe(true);

    const bodeguero = await login('bodeguero@example.com');
    expect(bodeguero.status).toBe(200);
    expect(bodeguero.body.token).toBeTruthy();
  });

  it('no permite que un bodeguero cree usuarios', async () => {
    const bodeguero = await crearUsuario('bodeguero', 'bodeguero@example.com');
    const token = (await login(bodeguero.email)).body.token;
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Otro usuario',
        email: 'otro@example.com',
        password: 'ClaveSegura123',
      });

    expect(response.status).toBe(403);
    expect(await User.countDocuments()).toBe(1);
  });

  it('rechaza credenciales incorrectas con la misma respuesta segura', async () => {
    await crearUsuario('bodeguero', 'ana@example.com');
    const wrongPassword = await login('ana@example.com', 'ClaveErronea123');
    const wrongEmail = await login('no-existe@example.com', 'ClaveErronea123');

    expect(wrongPassword.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ message: 'Credenciales inválidas.' });
    expect(wrongEmail.body).toEqual({ message: 'Credenciales inválidas.' });
  });

  it('proporciona perfil autenticado y rechaza tokens ausentes, inválidos o expirados', async () => {
    const usuario = await crearUsuario('bodeguero', 'ana@example.com');
    const token = (await login(usuario.email)).body.token;
    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe('ana@example.com');
    expect(profile.body.user).not.toHaveProperty('passwordHash');

    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')).status).toBe(401);

    const expiredToken = jwt.sign({ sub: usuario.id }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)).status).toBe(401);
  });

  it('un usuario desactivado deja de usar un token emitido previamente', async () => {
    const usuario = await crearUsuario('bodeguero', 'ana@example.com');
    const token = (await login(usuario.email)).body.token;
    usuario.activo = false;
    await usuario.save();

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  it('permite al bodeguero actualizarse, pero no consultar o cambiar otra cuenta', async () => {
    const propio = await crearUsuario('bodeguero', 'ana@example.com');
    const otro = await crearUsuario('bodeguero', 'otro@example.com');
    const token = (await login(propio.email)).body.token;

    const update = await request(app)
      .patch(`/api/users/${propio.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Ana actualizada' });
    expect(update.status).toBe(200);
    expect(update.body.usuario.nombre).toBe('Ana actualizada');

    expect((await request(app).get('/api/users')
      .set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).get(`/api/users/${otro.id}`)
      .set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).patch(`/api/users/${otro.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'No permitido' })).status).toBe(403);
    expect((await request(app).patch(`/api/users/${propio.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' })).status).toBe(400);
  });

  it('administra usuarios y evita que el administrador se desactive a sí mismo', async () => {
    const admin = await crearUsuario('admin', 'admin@example.com');
    const bodeguero = await crearUsuario('bodeguero', 'bodeguero@example.com');
    const token = (await login(admin.email)).body.token;

    const listado = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(listado.status).toBe(200);
    expect(listado.body).toHaveLength(2);
    expect(listado.body[0]).not.toHaveProperty('passwordHash');

    const selfDisable = await request(app).patch(`/api/users/${admin.id}/desactivar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false });
    expect(selfDisable.status).toBe(400);

    const disable = await request(app).patch(`/api/users/${bodeguero.id}/desactivar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false });
    expect(disable.status).toBe(200);
    expect(disable.body.usuario.activo).toBe(false);
  });

  it('el seed crea un administrador una sola vez sin restablecer su contraseña', async () => {
    const config = {
      nombre: 'Admin de seed',
      email: 'seed-admin@example.com',
      password: 'ClaveSegura123',
    };

    expect(await ensureAdmin(config)).toBe(true);
    const original = await User.findOne({ email: config.email }).select('+passwordHash');
    expect(await ensureAdmin({ ...config, password: 'OtraClave123' })).toBe(false);

    const persisted = await User.findOne({ email: config.email }).select('+passwordHash');
    expect(await bcrypt.compare(config.password, persisted.passwordHash)).toBe(true);
    expect(persisted.passwordHash).toBe(original.passwordHash);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });
});
