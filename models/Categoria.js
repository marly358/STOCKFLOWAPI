const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio.'],
      trim: true,
      minlength: [1, 'El nombre no puede estar vacío.'],
    },
    nombreNormalizado: {
      type: String,
      required: true,
      select: false,
    },
    descripcion: {
      type: String,
      trim: true,
    },
  },
  {
    toJSON: {
      transform: (document, result) => {
        delete result.nombreNormalizado;
        return result;
      },
    },
  }
);

categoriaSchema.pre('validate', function normalizarNombre() {
  if (typeof this.nombre === 'string') {
    this.nombreNormalizado = this.nombre.normalize('NFKC').trim().toLocaleLowerCase('es');
  }
});

categoriaSchema.index({ nombreNormalizado: 1 }, { unique: true });

module.exports = mongoose.model('Categoria', categoriaSchema);