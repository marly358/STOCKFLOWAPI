jest.mock('../../services/userService', () => ({
  crearUsuario: jest.fn(),
  buscarUsuarioPorEmail: jest.fn(),
  listarUsuarios: jest.fn(),
  obtenerUsuarioPorId: jest.fn(),
  actualizarUsuarioPorId: jest.fn(),
  cambiarPasswordPorId: jest.fn(),
  desactivarUsuarioPorId: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const authController = require('../../controllers/authController');
const userController = require('../../controllers/userController');
const authMiddleware = require('../../middleware/auth');
const userService = require('../../services/userService');
const User = require('../../models/User');

describe('Seguridad y permisos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rechaza el registro si se intenta asignar un rol administrador', async () => {
    userService.buscarUsuarioPorEmail.mockResolvedValue(null);

    const req = {
      body: {
        nombre: 'Ana Gómez',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
        role: 'admin',
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authController.registrarUsuario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(userService.crearUsuario).not.toHaveBeenCalled();
  });

  it('rechaza intento de actualización de rol a un usuario normal', async () => {
    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { role: 'admin' },
      user: { id: '507f1f77bcf86cd799439011', role: 'usuario' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await userController.actualizarUsuario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Los datos del usuario no son válidos.',
      })
    );
  });

  it('deniega acceso por rol insuficiente', () => {
    const req = { user: { role: 'usuario' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware.autorizarRoles('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza tokens inválidos', async () => {
    jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('invalid token');
    });

    const req = { headers: { authorization: 'Bearer token-invalido' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authMiddleware.autenticarUsuario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token inválido.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('exige la contraseña actual para cambiar la propia contraseña', async () => {
    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { newPassword: 'ClaveSegura123' },
      user: { id: '507f1f77bcf86cd799439011', role: 'usuario' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        passwordHash: '$2a$10$hashfake',
      }),
    });

    await userController.cambiarPassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La contraseña actual es obligatoria.' });
  });

  it('permite a un administrador cambiar la contraseña de otro usuario sin exigir la actual', async () => {
    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { newPassword: 'ClaveSegura123' },
      user: { id: '111111111111111111111111', role: 'admin' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        passwordHash: '$2a$10$hashfake',
      }),
    });
    userService.cambiarPasswordPorId.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });

    await userController.cambiarPassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(userService.cambiarPasswordPorId).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'ClaveSegura123'
    );
  });
});
