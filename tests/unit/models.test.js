const Categoria = require('../../models/Categoria');
const Movimiento = require('../../models/Movimiento');
const Producto = require('../../models/Producto');
const User = require('../../models/User');

describe('modelos Mongoose (bottom-up: validación de componentes)', () => {
  test('acepta un producto válido y rechaza stock fraccionario', async () => {
    await expect(
      new Producto({ nombre: 'Teclado', precio: 10, stock: 3 }).validate()
    ).resolves.toBeUndefined();

    await expect(
      new Producto({ nombre: 'Teclado', precio: 10, stock: 1.5 }).validate()
    ).rejects.toHaveProperty('errors.stock');
  });

  test('normaliza el nombre de categoría antes de validar', async () => {
    const categoria = new Categoria({ nombre: '  CAFÉ  ' });

    await categoria.validate();

    expect(categoria.nombreNormalizado).toBe('café');
  });

  test('limita roles a admin y bodeguero', async () => {
    const bodeguero = new User({
      nombre: 'Bodega',
      email: 'bodega@example.com',
      passwordHash: 'ClaveSegura123',
    });
    await bodeguero.validate();
    expect(bodeguero.role).toBe('bodeguero');

    const rolAnterior = new User({
      nombre: 'Anterior',
      email: 'anterior@example.com',
      passwordHash: 'ClaveSegura123',
      role: 'usuario',
    });
    await expect(rolAnterior.validate()).rejects.toHaveProperty('errors.role');
  });

  test('rechaza movimientos con tipo o cantidad inválidos', async () => {
    const movimiento = new Movimiento({
      producto: '507f1f77bcf86cd799439011',
      tipo: 'AJUSTE',
      cantidad: 0,
    });

    await expect(movimiento.validate()).rejects.toMatchObject({
      errors: {
        tipo: expect.anything(),
        cantidad: expect.anything(),
      },
    });
  });
});
