const mongoose = require('mongoose');

const movimientoSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: [true, 'El producto es obligatorio.'],
  },
  tipo: {
    type: String,
    enum: {
      values: ['ENTRADA', 'SALIDA'],
      message: 'El tipo de movimiento debe ser ENTRADA o SALIDA.',
    },
    required: [true, 'El tipo de movimiento es obligatorio.'],
  },
  cantidad: {
    type: Number,
    required: [true, 'La cantidad es obligatoria.'],
    min: [1, 'La cantidad debe ser un entero positivo.'],
    validate: {
      validator: Number.isInteger,
      message: 'La cantidad debe ser un entero positivo.',
    },
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Movimiento', movimientoSchema);
