import { z } from "zod";
import { idSchema } from "./comunes";
import { crearValidacion } from "./validacion";

// Forma de la entrada de los endpoints de usuarios: las rutas montan `.middleware` y los
// controllers leen con `.leer`.
export const usuarioPorId = crearValidacion({ params: z.object({ id: idSchema }) });
