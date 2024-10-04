import express from 'express';
import usuarioRoutes from './routes/usuario.routers.js';
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api', usuarioRoutes);

app.get('/', (req, res) => {
  const name = process.env.NAME || 'World';
  res.send(`Hello ${name}`);
});

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
  const port = parseInt(process.env.PORT, 10) || 3000;
  app.listen(port, () => {
    console.log(`listening on port ${port}`);
  });
}

// Importante: exportar la app para Vercel
export default app;