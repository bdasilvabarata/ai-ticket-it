import { z } from "zod";
import { idSchema } from "../middlewares/esquemas-comunes";
import { crearValidacion } from "../middlewares/validar";

// Forma de la entrada de cada endpoint de usuarios. Vive junto a los controllers: las rutas
// la montan (routes → controllers) y los controllers la leen tipada.
export const usuarioPorId = crearValidacion({ params: z.object({ id: idSchema }) });
