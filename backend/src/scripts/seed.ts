import mongoose from "mongoose";
import { env } from "../config/env";
import { cargarSeed } from "../seed/cargar-seed";
import { ejecutarSeed } from "./seed-opciones";

// `npm run seed -- --forzar`: sin lógica propia, solo cablea dependencias reales.
process.exitCode = await ejecutarSeed({
  argv: process.argv.slice(2),
  mongoUri: env.MONGO_URI,
  conectar: (uri) => mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }),
  cargar: () => cargarSeed(),
  desconectar: () => mongoose.disconnect(),
  escribir: console.log,
  escribirError: console.error,
});
