const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio.'],
    trim: true,
    minlength: [1, 'El nombre no puede estar vacío.'],
  },
  precio: {
    type: Number,
    required: [true, 'El precio es obligatorio.'],
    min: [0, 'El precio debe ser mayor o igual a 0.'],
    validate: {
      validator: Number.isFinite,
      message: 'El precio debe ser un número finito.',
    },
  },
  stock: {
    type: Number,
    required: [true, 'El stock es obligatorio.'],
    min: [0, 'El stock debe ser mayor o igual a 0.'],
    validate: {
      validator: Number.isInteger,
      message: 'El stock debe ser un número entero.',
    },
  },
  activo: {
    type: Boolean,
    default: true,
  },
  descripcion: {
    type: String,
    trim: true,
  },
});

module.exports = mongoose.model('Producto', productoSchema);
