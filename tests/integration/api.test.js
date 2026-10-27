const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../server');
const Categoria = require('../../models/Categoria');
const Movimiento = require('../../models/Movimiento');
const Producto = require('../../models/Producto');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('stockflow_jest'));
  await Promise.all([Categoria.init(), Movimiento.init(), Producto.init()]);
}, 300000);

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  await Promise.all([
    Categoria.deleteMany({}),
    Movimiento.deleteMany({}),
    Producto.deleteMany({}),
  ]);
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

  test('crea, consulta, actualiza y elimina productos', async () => {
    const creado = await request(app)
      .post('/api/productos')
      .send({ nombre: ' Teclado ', precio: 19.99, stock: 5 });

    expect(creado.status).toBe(201);
    expect(creado.body.producto.nombre).toBe('Teclado');
    expect((await request(app).get('/api/productos')).body).toHaveLength(1);

    const actualizado = await request(app)
      .patch(`/api/productos/${creado.body.producto._id}`)
      .send({ stock: 8 });
    expect(actualizado.status).toBe(200);
    expect(actualizado.body.producto.stock).toBe(8);

    const eliminado = await request(app).delete(
      `/api/productos/${creado.body.producto._id}`
    );
    expect(eliminado.status).toBe(200);
    expect(await Producto.countDocuments()).toBe(0);
  });

  test('rechaza producto inválido y distingue IDs incorrectos de productos inexistentes', async () => {
    const invalido = await request(app)
      .post('/api/productos')
      .send({ nombre: '', precio: -1, stock: 1.2 });
    expect(invalido.status).toBe(400);

    const idInvalido = await request(app).delete('/api/productos/no-es-id');
    expect(idInvalido.status).toBe(400);

    const inexistente = await request(app).delete(
      '/api/productos/507f1f77bcf86cd799439011'
    );
    expect(inexistente.status).toBe(404);
  });

  test('crea y consulta categorías, y rechaza nombres duplicados sin distinguir mayúsculas', async () => {
    const creada = await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Bebidas' });
    expect(creada.status).toBe(201);

    const duplicada = await request(app)
      .post('/api/categorias')
      .send({ nombre: ' bebidas ' });
    expect(duplicada.status).toBe(409);

    const lista = await request(app).get('/api/categorias');
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]).not.toHaveProperty('nombreNormalizado');
  });

  test('valida campos requeridos al crear una categoría', async () => {
    const response = await request(app).post('/api/categorias').send({ nombre: ' ' });

    expect(response.status).toBe(400);
    expect(await Categoria.countDocuments()).toBe(0);
  });

  test('registra entradas y salidas, y devuelve las existencias actualizadas', async () => {
    const creado = await request(app)
      .post('/api/productos')
      .send({ nombre: 'Monitor', precio: 100, stock: 3 });
    const productoId = creado.body.producto._id;

    const entrada = await request(app)
      .post('/api/inventario/entradas')
      .send({ productoId, cantidad: 4 });
    expect(entrada.status).toBe(201);
    expect(entrada.body.producto.stock).toBe(7);
    expect(entrada.body.movimiento.tipo).toBe('ENTRADA');

    const salida = await request(app)
      .post('/api/inventario/salidas')
      .send({ productoId, cantidad: 2 });
    expect(salida.status).toBe(201);
    expect(salida.body.producto.stock).toBe(5);

    const existencias = await request(app).get('/api/inventario/existencias');
    expect(existencias.status).toBe(200);
    expect(existencias.body).toEqual([
      expect.objectContaining({ _id: productoId, nombre: 'Monitor', stock: 5 }),
    ]);
    expect(await Movimiento.countDocuments()).toBe(2);
  });

  test('rechaza movimientos inválidos, IDs desconocidos y salidas sin existencias', async () => {
    const producto = await request(app)
      .post('/api/productos')
      .send({ nombre: 'Ratón', precio: 10, stock: 1 });
    const productoId = producto.body.producto._id;

    const datosInvalidos = await request(app)
      .post('/api/inventario/entradas')
      .send({ productoId: 'no-es-id', cantidad: 0 });
    expect(datosInvalidos.status).toBe(400);

    const idInexistente = await request(app)
      .post('/api/inventario/entradas')
      .send({ productoId: '507f1f77bcf86cd799439011', cantidad: 1 });
    expect(idInexistente.status).toBe(404);

    const stockInsuficiente = await request(app)
      .post('/api/inventario/salidas')
      .send({ productoId, cantidad: 2 });
    expect(stockInsuficiente.status).toBe(409);

    expect((await Producto.findById(productoId)).stock).toBe(1);
    expect(await Movimiento.countDocuments()).toBe(0);
  });
});
