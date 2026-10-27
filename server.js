if (require.main === module) {
  require('dotenv').config();
}

const express = require('express');
const connectDB = require('./config/db');
const productoRoutes = require('./routes/productoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const movimientoRoutes = require('./routes/movimientoRoutes');

const app = express();

// Puerto configurable mediante variable de entorno (fallback a 3000).
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'StockFlowAPI' });
});

app.use('/api/productos', productoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/inventario', movimientoRoutes);

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'El cuerpo de la solicitud debe contener JSON válido.',
    });
  }

  console.error('Error al procesar la solicitud:', error);
  return res.status(500).json({ message: 'Error interno del servidor.' });
});

// El servidor solo empieza a escuchar una vez establecida la conexión con MongoDB.
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Servidor de StockFlowAPI escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
