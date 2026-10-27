const Producto = require('../../models/Producto');
const {
  registrarProducto,
  actualizarProductoPorId,
} = require('../../services/productoService');

describe('servicio de productos', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('crea productos con stock inicial cero', async () => {
    jest.spyOn(Producto.prototype, 'save').mockImplementation(function save() {
      return Promise.resolve(this);
    });

    const producto = await registrarProducto({ nombre: 'Teclado', precio: 20 });
    expect(producto.stock).toBe(0);
    expect(producto.activo).toBe(true);
  });

  test('rechaza stock directo aun cuando se invoca el servicio sin controlador', async () => {
    const findByIdAndUpdate = jest.spyOn(Producto, 'findByIdAndUpdate');

    await expect(registrarProducto({
      nombre: 'Teclado',
      precio: 20,
      stock: 5,
    })).rejects.toMatchObject({ code: 'PRODUCT_STOCK_IMMUTABLE' });

    await expect(actualizarProductoPorId('507f1f77bcf86cd799439011', {
      stock: 5,
    })).rejects.toMatchObject({ code: 'PRODUCT_STOCK_IMMUTABLE' });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
