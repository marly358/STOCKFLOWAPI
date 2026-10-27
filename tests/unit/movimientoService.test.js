jest.mock('../../models/Movimiento', () => ({
  create: jest.fn(),
}));
jest.mock('../../models/Producto', () => ({
  exists: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const mongoose = require('mongoose');
const Movimiento = require('../../models/Movimiento');
const Producto = require('../../models/Producto');
const { registrarMovimiento } = require('../../services/movimientoService');

describe('servicio de inventario (bottom-up: reglas transaccionales aisladas)', () => {
  let session;

  beforeEach(() => {
    session = {
      withTransaction: jest.fn(async (operation) => operation()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    Producto.exists.mockReturnValue({
      session: jest.fn().mockResolvedValue({ _id: 'producto-1' }),
    });
  });

  test('incrementa stock y guarda una entrada en una transacción', async () => {
    const producto = { _id: 'producto-1', stock: 7 };
    const movimiento = { tipo: 'ENTRADA', cantidad: 2 };
    const productoId = '507f1f77bcf86cd799439011';
    const responsableId = '507f191e810c19729de860ea';
    Producto.findOneAndUpdate.mockResolvedValue(producto);
    Movimiento.create.mockResolvedValue([movimiento]);

    await expect(registrarMovimiento(productoId, 2, 'ENTRADA', responsableId)).resolves.toEqual({
      movimiento,
      producto,
    });

    expect(Producto.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: productoId, activo: { $ne: false } },
      { $inc: { stock: 2 } },
      { returnDocument: 'after', session }
    );
    expect(Movimiento.create).toHaveBeenCalledWith(
      [{ producto: productoId, tipo: 'ENTRADA', cantidad: 2, responsable: responsableId }],
      { session }
    );
    expect(session.endSession).toHaveBeenCalled();
  });

  test('condiciona la salida a stock suficiente y termina la sesión en error', async () => {
    const productoId = '507f1f77bcf86cd799439011';
    const responsableId = '507f191e810c19729de860ea';
    Producto.findOneAndUpdate.mockResolvedValue(null);

    await expect(registrarMovimiento(productoId, 5, 'SALIDA', responsableId)).rejects.toMatchObject({
      code: 'INVENTORY_INSUFFICIENT_STOCK',
    });

    expect(Producto.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: productoId, activo: { $ne: false }, stock: { $gte: 5 } },
      { $inc: { stock: -5 } },
      { returnDocument: 'after', session }
    );
    expect(Movimiento.create).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test('rechaza datos de movimiento inválidos antes de iniciar una transacción', async () => {
    await expect(registrarMovimiento(
      '507f1f77bcf86cd799439011',
      1.5,
      'ENTRADA',
      '507f191e810c19729de860ea'
    )).rejects.toMatchObject({ code: 'INVENTORY_INVALID_INPUT' });
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });
});
