import { z } from "zod";
import { idSchema } from "./schemas/comunes";

export const usuarioPorIdSchema = { params: z.object({ id: idSchema }) };
