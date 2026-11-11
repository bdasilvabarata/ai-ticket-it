import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Boton, tema } from "../../../componentes";
import { aFechaDePared, aFechaDelSelector } from "../fecha-de-pared";
import { textoFechaHora } from "../formato";
import { estilosDeCampo } from "./CampoDeTexto";
import { MensajeDeCampo } from "./MensajeDeCampo";

type Modo = "date" | "time";

export interface PropsSelectorFechaHora {
  /** "YYYY-MM-DDTHH:mm" en hora de Buenos Aires, o `null`. */
  valor: string | null;
  alCambiar: (fechaHoraLocal: string) => void;
  error?: string;
}

/**
 * Fecha y hora con el selector nativo, sin escribirlas (FR-010, research R11). Arma la hora de
 * pared sin convertir zonas, y no limita a fechas futuras: lo decide el reloj del servidor.
 */
export function SelectorFechaHora({ valor, alCambiar, error }: PropsSelectorFechaHora) {
  // La fecha del teléfono es solo el punto de partida del selector: no decide nada.
  const [partida] = useState(() => new Date());
  const [modoAbierto, setModoAbierto] = useState<Modo | null>(null);
  const actual = valor ? aFechaDelSelector(valor) : partida;

  function aplicar(modo: Modo, elegida: Date) {
    const nueva = new Date(actual);
    if (modo === "date") nueva.setFullYear(elegida.getFullYear(), elegida.getMonth(), elegida.getDate());
    else nueva.setHours(elegida.getHours(), elegida.getMinutes(), 0, 0);
    alCambiar(aFechaDePared(nueva));
  }

  function abrir(modo: Modo) {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: actual,
        mode: modo,
        is24Hour: true,
        onValueChange: (_evento, elegida) => aplicar(modo, elegida),
      });
    } else {
      setModoAbierto(modo);
    }
  }

  return (
    <View accessibilityLabel="Fecha y hora" style={estilos.contenedor}>
      <Text style={estilosDeCampo.etiqueta}>Fecha y hora</Text>
      <Text style={estilos.valor}>{valor ? textoFechaHora(valor) : "Sin elegir"}</Text>
      <Text style={estilosDeCampo.nota}>Hora de Buenos Aires</Text>
      <View style={estilos.botones}>
        <Boton variante="aviso" texto="Elegir fecha" alPresionar={() => abrir("date")} />
        <Boton variante="aviso" texto="Elegir hora" alPresionar={() => abrir("time")} />
      </View>
      {modoAbierto ? (
        <View style={estilos.selector}>
          <DateTimePicker
            value={actual}
            mode={modoAbierto}
            display={modoAbierto === "date" ? "inline" : "spinner"}
            is24Hour
            onValueChange={(_evento, elegida) => aplicar(modoAbierto, elegida)}
          />
          <Boton variante="texto" texto="Listo" alPresionar={() => setModoAbierto(null)} />
        </View>
      ) : null}
      <MensajeDeCampo mensaje={error} />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: tema.espacio.minimo },
  valor: { fontSize: tema.texto.normal, color: tema.colores.texto },
  botones: { flexDirection: "row", flexWrap: "wrap", gap: tema.espacio.chico, marginTop: tema.espacio.chico },
  selector: { alignItems: "flex-end" },
});
