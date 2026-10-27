const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio.'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres.'],
    },
    email: {
      type: String,
      required: [true, 'El correo es obligatorio.'],
      trim: true,
      lowercase: true,
      validate: {
        validator(value) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'El correo no tiene un formato válido.',
      },
    },
    emailNormalizado: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      select: false,
    },
    passwordHash: {
      type: String,
      required: [true, 'La contraseña es obligatoria.'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['usuario', 'admin'],
        message: 'El rol debe ser usuario o admin.',
      },
      default: 'usuario',
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, result) => {
        delete result.passwordHash;
        delete result.emailNormalizado;
        delete result.__v;
        return result;
      },
    },
  }
);

userSchema.pre('validate', function normalizarDatosUsuario(next) {
  if (typeof this.email === 'string') {
    this.emailNormalizado = normalizarEmail(this.email);
  }
  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
