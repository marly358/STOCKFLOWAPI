const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('../../config/db');
const app = require('../../server');

jest.setTimeout(60000);

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-jwt';
  process.env.JWT_EXPIRES_IN = '1h';

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('stockflow-test');

  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('API de autenticación y usuarios', () => {
  it('registra un usuario con datos válidos', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Ana Gómez',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      });

    expect(response.status).toBe(201);
    expect(response.body.usuario.email).toBe('ana@example.com');
    expect(response.body.usuario.role).toBe('usuario');
  });

  it('rechaza un registro con correo duplicado', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Ana Gómez',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      });

    expect(response.status).toBe(409);
  });

  it('inicia sesión con credenciales correctas y devuelve JWT', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.usuario.email).toBe('ana@example.com');
  });

  it('rechaza credenciales incorrectas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ana@example.com',
        password: 'ClaveErronea123',
      });

    expect(response.status).toBe(401);
  });

  it('proporciona perfil autenticado', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('ana@example.com');
  });

  it('rechaza acceso a ruta protegida sin token', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('permite a un usuario consultar su perfil y actualizar sus datos', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      });

    const response = await request(app)
      .patch('/api/users/' + loginResponse.body.usuario._id)
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .send({ nombre: 'Ana M. Gómez' });

    expect(response.status).toBe(200);
    expect(response.body.usuario.nombre).toBe('Ana M. Gómez');
  });

  it('deniega acceso de un usuario normal a listado administrativo', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      });

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${loginResponse.body.token}`);

    expect(response.status).toBe(403);
  });
});
