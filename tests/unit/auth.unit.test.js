const { validarPassword } = require('../../controllers/authController');

describe('Validación de credenciales', () => {
  it('rechaza contraseñas con formato insuficiente', () => {
    expect(validarPassword('abc123')).toBe(false);
    expect(validarPassword('Abc123')).toBe(false);
  });

  it('acepta contraseñas con formato correcto', () => {
    expect(validarPassword('ClaveSegura123')).toBe(true);
  });
});
