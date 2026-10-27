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
    Producto.findOneAndUpdate.mockResolvedValue(producto);
    Movimiento.create.mockResolvedValue([movimiento]);

    await expect(registrarMovimiento('producto-1', 2, 'ENTRADA')).resolves.toEqual({
      movimiento,
      producto,
    });

    expect(Producto.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'producto-1' },
      { $inc: { stock: 2 } },
      { new: true, session }
    );
    expect(Movimiento.create).toHaveBeenCalledWith(
      [{ producto: 'producto-1', tipo: 'ENTRADA', cantidad: 2 }],
      { session }
    );
    expect(session.endSession).toHaveBeenCalled();
  });

  test('condiciona la salida a stock suficiente y termina la sesión en error', async () => {
    Producto.findOneAndUpdate.mockResolvedValue(null);

    await expect(registrarMovimiento('producto-1', 5, 'SALIDA')).rejects.toMatchObject({
      code: 'INVENTORY_INSUFFICIENT_STOCK',
    });

    expect(Producto.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'producto-1', stock: { $gte: 5 } },
      { $inc: { stock: -5 } },
      { new: true, session }
    );
    expect(Movimiento.create).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });
});
