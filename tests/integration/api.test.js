const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../server');
const Categoria = require('../../models/Categoria');
const Movimiento = require('../../models/Movimiento');
const Producto = require('../../models/Producto');
const User = require('../../models/User');

let mongo;
let adminToken;
let bodegueroToken;
let admin;
let bodeguero;

async function crearUsuario(role, email) {
  const usuario = new User({
    nombre: role === 'admin' ? 'Administradora' : 'Bodeguero',
    email,
    passwordHash: 'ClaveSegura123',
    role,
  });
  await usuario.save();
  return usuario;
}

async function iniciarSesion(email) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'ClaveSegura123' });
  expect(response.status).toBe(200);
  return response.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'api-integration-secret';
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('stockflow_jest'));
  await Promise.all([
    Categoria.init(),
    Movimiento.init(),
    Producto.init(),
    User.init(),
  ]);
}, 300000);

beforeEach(async () => {
  await Promise.all([
    Categoria.deleteMany({}),
    Movimiento.deleteMany({}),
    Producto.deleteMany({}),
    User.deleteMany({}),
  ]);
  admin = await crearUsuario('admin', 'admin@example.com');
  bodeguero = await crearUsuario('bodeguero', 'bodeguero@example.com');
  adminToken = await iniciarSesion(admin.email);
  bodegueroToken = await iniciarSesion(bodeguero.email);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

describe('API HTTP con Supertest y MongoDB efímero', () => {
  test('expone el estado de la API', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'StockFlowAPI' });
  });

  test('protege productos y permite consultas a ambos roles', async () => {
    expect((await request(app).get('/api/productos')).status).toBe(401);
    expect((await request(app).get('/api/productos').set('Authorization', `Bearer ${bodegueroToken}`)).status)
      .toBe(200);
    expect((await request(app).post('/api/productos').set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ nombre: 'Teclado', precio: 19.99 })).status).toBe(403);

    const creado = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: ' Teclado ', precio: 19.99, descripcion: 'Mecánico' });
    expect(creado.status).toBe(201);
    expect(creado.body.producto.nombre).toBe('Teclado');
    expect(creado.body.producto.stock).toBe(0);

    const edicionDenegada = await request(app)
      .patch(`/api/productos/${creado.body.producto._id}`)
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ precio: 1 });
    const eliminacionDenegada = await request(app)
      .delete(`/api/productos/${creado.body.producto._id}`)
      .set('Authorization', `Bearer ${bodegueroToken}`);
    expect(edicionDenegada.status).toBe(403);
    expect(eliminacionDenegada.status).toBe(403);

    const lista = await request(app).get('/api/productos')
      .set('Authorization', `Bearer ${bodegueroToken}`);
    expect(lista.body).toHaveLength(1);
    const individual = await request(app).get(`/api/productos/${creado.body.producto._id}`)
      .set('Authorization', `Bearer ${bodegueroToken}`);
    expect(individual.status).toBe(200);
  });

  test('rechaza stock directo en creación y actualización; permite actualizar otros campos', async () => {
    const creado = await request(app).post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Teclado', precio: 19.99 });
    const id = creado.body.producto._id;

    const crearConStock = await request(app).post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Ratón', precio: 10, stock: 5 });
    expect(crearConStock.status).toBe(400);

    const actualizarStock = await request(app).patch(`/api/productos/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stock: 8 });
    expect(actualizarStock.status).toBe(400);

    const actualizarPrecio = await request(app).patch(`/api/productos/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ precio: 22 });
    expect(actualizarPrecio.status).toBe(200);
    expect(actualizarPrecio.body.producto.stock).toBe(0);

    const eliminado = await request(app).delete(`/api/productos/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(eliminado.status).toBe(200);
    expect(await Producto.countDocuments()).toBe(0);
  });

  test('valida IDs y permisos de eliminación de producto', async () => {
    const idInvalido = await request(app).delete('/api/productos/no-es-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(idInvalido.status).toBe(400);

    const inexistente = await request(app).delete('/api/productos/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inexistente.status).toBe(404);
  });

  test('protege categorías, normaliza unicidad y permite CRUD administrativo', async () => {
    expect((await request(app).get('/api/categorias')).status).toBe(401);
    const creada = await request(app).post('/api/categorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Bebidas' });
    expect(creada.status).toBe(201);

    const duplicada = await request(app).post('/api/categorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: ' bebidas ' });
    expect(duplicada.status).toBe(409);

    expect((await request(app).post('/api/categorias')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ nombre: 'No autorizada' })).status).toBe(403);

    const segunda = await request(app).post('/api/categorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Alimentos' });
    const renameDuplicada = await request(app).patch(`/api/categorias/${creada.body.categoria._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: ' alimentos ' });
    expect(segunda.status).toBe(201);
    expect(renameDuplicada.status).toBe(409);

    const lista = await request(app).get('/api/categorias')
      .set('Authorization', `Bearer ${bodegueroToken}`);
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(2);
    expect(lista.body[0]).not.toHaveProperty('nombreNormalizado');

    const actualizada = await request(app).patch(`/api/categorias/${creada.body.categoria._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ descripcion: 'Bebidas frías' });
    expect(actualizada.status).toBe(200);

    const denegada = await request(app).delete(`/api/categorias/${creada.body.categoria._id}`)
      .set('Authorization', `Bearer ${bodegueroToken}`);
    expect(denegada.status).toBe(403);
    expect((await request(app).delete(`/api/categorias/${creada.body.categoria._id}`)
      .set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });

  test('registra entradas/salidas con responsable y consulta historial', async () => {
    expect((await request(app).get('/api/inventario/movimientos')).status).toBe(401);
    const creado = await request(app).post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Monitor', precio: 100 });
    const productoId = creado.body.producto._id;

    const entrada = await request(app)
      .post('/api/inventario/entradas')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ productoId, cantidad: 4 });
    expect(entrada.status).toBe(201);
    expect(entrada.body.producto.stock).toBe(4);
    expect(entrada.body.movimiento.tipo).toBe('ENTRADA');
    expect(entrada.body.movimiento.responsable).toBe(bodeguero.id);

    const salida = await request(app)
      .post('/api/inventario/salidas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, cantidad: 2 });
    expect(salida.status).toBe(201);
    expect(salida.body.producto.stock).toBe(2);
    expect(salida.body.movimiento.responsable).toBe(admin.id);

    const existencias = await request(app).get('/api/inventario/existencias')
      .set('Authorization', `Bearer ${bodegueroToken}`);
    expect(existencias.body).toEqual([
      expect.objectContaining({ _id: productoId, nombre: 'Monitor', stock: 2 }),
    ]);

    const historial = await request(app).get('/api/inventario/movimientos')
      .set('Authorization', `Bearer ${bodegueroToken}`);
    expect(historial.status).toBe(200);
    expect(historial.body).toHaveLength(2);
    expect(historial.body[0].responsable).toHaveProperty('email');
    expect(historial.body[0].responsable).not.toHaveProperty('passwordHash');
  });

  test('rechaza movimientos inválidos, inexistentes e insuficientes sin cambios parciales', async () => {
    const creado = await request(app).post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Ratón', precio: 10 });
    const productoId = creado.body.producto._id;

    const datosInvalidos = await request(app).post('/api/inventario/entradas')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ productoId, cantidad: 0 });
    expect(datosInvalidos.status).toBe(400);

    const responsableFalsificado = await request(app).post('/api/inventario/entradas')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ productoId, cantidad: 1, responsable: admin.id });
    expect(responsableFalsificado.status).toBe(400);

    const idInexistente = await request(app).post('/api/inventario/entradas')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ productoId: '507f1f77bcf86cd799439011', cantidad: 1 });
    expect(idInexistente.status).toBe(404);

    const sinStock = await request(app).post('/api/inventario/salidas')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ productoId, cantidad: 2 });
    expect(sinStock.status).toBe(409);
    expect((await Producto.findById(productoId)).stock).toBe(0);
    expect(await Movimiento.countDocuments()).toBe(0);
  });

  test('revierte el stock si no se puede guardar el movimiento', async () => {
    const creado = await request(app).post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Transacción fallida', precio: 1 });
    const productoId = creado.body.producto._id;
    const createMovimiento = jest.spyOn(Movimiento, 'create').mockRejectedValueOnce(
      new Error('Fallo simulado al guardar el movimiento')
    );
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await request(app).post('/api/inventario/entradas')
        .set('Authorization', `Bearer ${bodegueroToken}`)
        .send({ productoId, cantidad: 3 });
      expect(response.status).toBe(500);
      expect((await Producto.findById(productoId)).stock).toBe(0);
      expect(await Movimiento.countDocuments()).toBe(0);
    } finally {
      createMovimiento.mockRestore();
      logError.mockRestore();
    }
  });

  test('las salidas concurrentes no exceden el stock disponible', async () => {
    const creado = await request(app).post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Stock concurrente', precio: 1 });
    const productoId = creado.body.producto._id;
    await request(app).post('/api/inventario/entradas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, cantidad: 5 });

    const responses = await Promise.all([
      request(app).post('/api/inventario/salidas')
        .set('Authorization', `Bearer ${bodegueroToken}`)
        .send({ productoId, cantidad: 4 }),
      request(app).post('/api/inventario/salidas')
        .set('Authorization', `Bearer ${bodegueroToken}`)
        .send({ productoId, cantidad: 4 }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect((await Producto.findById(productoId)).stock).toBe(1);
    expect(await Movimiento.countDocuments({ producto: productoId })).toBe(2);
  });

  test('conserva productos con historial y bloquea movimientos posteriores', async () => {
    const creado = await request(app).post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Archivado', precio: 1 });
    const productoId = creado.body.producto._id;
    await request(app).post('/api/inventario/entradas')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ productoId, cantidad: 3 });

    const eliminado = await request(app).delete(`/api/productos/${productoId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(eliminado.status).toBe(200);
    expect(eliminado.body.producto.activo).toBe(false);
    expect(await Producto.countDocuments()).toBe(1);
    expect(await Movimiento.countDocuments({ producto: productoId })).toBe(1);
    expect((await request(app).get('/api/productos')
      .set('Authorization', `Bearer ${bodegueroToken}`)).body).toHaveLength(0);
    expect((await request(app).get('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)).body).toHaveLength(1);
    expect((await request(app).get(`/api/productos/${productoId}`)
      .set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);

    const movimiento = await request(app).post('/api/inventario/entradas')
      .set('Authorization', `Bearer ${bodegueroToken}`)
      .send({ productoId, cantidad: 1 });
    expect(movimiento.status).toBe(409);
  });
});
