const express = require('express');
const connectDB = require('./config/db');

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'StockFlowAPI' });
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

startServer();
