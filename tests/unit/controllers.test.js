jest.mock('../../services/productoService', () => ({
  registrarProducto: jest.fn(),
  listarProductos: jest.fn(),
  actualizarProductoPorId: jest.fn(),
  eliminarProductoPorId: jest.fn(),
}));
jest.mock('../../services/categoriaService', () => ({
  crearCategoria: jest.fn(),
  listarCategorias: jest.fn(),
}));
jest.mock('../../services/movimientoService', () => ({
  listarExistencias: jest.fn(),
  registrarMovimiento: jest.fn(),
}));

const productoService = require('../../services/productoService');
const categoriaService = require('../../services/categoriaService');
const movimientoService = require('../../services/movimientoService');
const {
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} = require('../../controllers/productoController');
const { crear: crearCategoria } = require('../../controllers/categoriaController');
const {
  registrarEntrada,
  registrarSalida,
} = require('../../controllers/movimientoController');

function respuestaFalsa() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('controladores (top-down: servicios aislados con mocks)', () => {
  test('rechaza datos de producto inválidos antes de llamar al servicio', async () => {
    const req = { body: { nombre: '', precio: -1, stock: 1.5 } };
    const res = respuestaFalsa();

    await crearProducto(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(productoService.registrarProducto).not.toHaveBeenCalled();
  });

  test('crea un producto válido y responde 201', async () => {
    const producto = { _id: 'p1', nombre: 'Teclado', precio: 20, stock: 4 };
    productoService.registrarProducto.mockResolvedValue(producto);
    const req = { body: { nombre: 'Teclado', precio: 20, stock: 4 } };
    const res = respuestaFalsa();

    await crearProducto(req, res, jest.fn());

    expect(productoService.registrarProducto).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Producto registrado correctamente.',
      producto,
    });
  });

  test('rechaza identificadores inválidos al actualizar', async () => {
    const res = respuestaFalsa();

    await actualizarProducto({ params: { id: 'incorrecto' }, body: { stock: 2 } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(productoService.actualizarProductoPorId).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el producto a eliminar no existe', async () => {
    productoService.eliminarProductoPorId.mockResolvedValue(null);
    const res = respuestaFalsa();

    await eliminarProducto(
      { params: { id: '507f1f77bcf86cd799439011' } },
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('mapea un conflicto de categoría duplicada a 409', async () => {
    categoriaService.crearCategoria.mockRejectedValue({ code: 'CATEGORY_DUPLICATE' });
    const res = respuestaFalsa();

    await crearCategoria({ body: { nombre: 'Bebidas' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('rechaza un productoId inválido para una entrada', async () => {
    const res = respuestaFalsa();

    await registrarEntrada({ body: { productoId: 'no-es-id', cantidad: 2 } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(movimientoService.registrarMovimiento).not.toHaveBeenCalled();
  });

  test('mapea existencias insuficientes para una salida a 409', async () => {
    movimientoService.registrarMovimiento.mockRejectedValue({
      code: 'INVENTORY_INSUFFICIENT_STOCK',
      message: 'No hay existencias suficientes.',
    });
    const res = respuestaFalsa();

    await registrarSalida(
      { body: { productoId: '507f1f77bcf86cd799439011', cantidad: 2 } },
      res,
      jest.fn()
    );

    expect(movimientoService.registrarMovimiento).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      2,
      'SALIDA'
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
