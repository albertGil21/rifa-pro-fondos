import express from 'express';
import usuarioRoutes from './routes/usuario.routers.js';
import cors from "cors"

const app = express();

app.use(cors());

app.use(express.json()); // To parse JSON bodies
app.use('/api', usuarioRoutes);

app.get('/', (req, res) => {
  const name = process.env.NAME || 'World';
  res.send(`Hello ${name}`);
});

const port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
