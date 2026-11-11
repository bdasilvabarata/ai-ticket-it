import { Archivo_400Regular, Archivo_500Medium, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";

import { tema } from "./tema";

/** Las fuentes del tema, por el nombre con que las usa `fontFamily` (para `useFonts`). */
export const fuentes = {
  [tema.fuente.display]: ArchivoBlack_400Regular,
  [tema.fuente.regular]: Archivo_400Regular,
  [tema.fuente.medio]: Archivo_500Medium,
  [tema.fuente.fuerte]: Archivo_700Bold,
};
