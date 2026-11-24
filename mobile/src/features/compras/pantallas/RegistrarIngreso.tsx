import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Alert, StyleSheet, Text, View, type TextInput } from "react-native";

import { ErrorDeApi } from "../../../api";
import { PantallaDesplazable, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { BuscadorDeCodigo } from "../componentes/BuscadorDeCodigo";
import { ResultadoDeIngreso } from "../componentes/ResultadoDeIngreso";
import {
  esEventoInexistente,
  salirPorEventoInexistente,
  useSalirSiNoExisteElEvento,
} from "../evento-inexistente";
import { normalizarCodigo } from "../formato";
import { useRegistrarUso } from "../mutaciones";
import { useEntradaDelEvento } from "../useEntradaDelEvento";

/**
 * "Registrar ingreso" (feature 008, US3; contracts/app.md): el organizador ingresa el código de una
 * entrada, ve de quién es y, si se puede usar, registra el ingreso tras confirmarlo. Se llega desde
 * "Compras del evento"; el permiso y la ventana los decide el servidor. Se dibuja en dos piezas
 * (feature 010, R8): `BuscadorDeCodigo` y `ResultadoDeIngreso`.
 */
export function RegistrarIngreso() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <Ingreso usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

type Aviso = { tipo: "exito" | "error"; mensaje: string };

function Ingreso({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const [texto, setTexto] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const consulta = useEntradaDelEvento(usuarioId, eventoId, codigo);
  const registrar = useRegistrarUso(usuarioId, eventoId);
  useSalirSiNoExisteElEvento(consulta.error);

  const buscar = () => {
    setAviso(null);
    // El mismo código otra vez vuelve a pedirlo (su estado pudo cambiar).
    const normalizado = normalizarCodigo(texto);
    if (normalizado === codigo) void consulta.refetch();
    else setCodigo(normalizado);
  };

  const alRegistrar = (entrada: EntradaDelEventoVista) => {
    const quien = `${entrada.compra.comprador.nombre} ${entrada.compra.comprador.apellido} · ${entrada.compra.tipoEntrada.nombre}`;
    Alert.alert("¿Registrar el ingreso?", `${quien}. No se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Registrar",
        onPress: () => {
          if (registrar.isPending) return;
          registrar.mutate(entrada.codigo, {
            onSuccess: () => {
              setAviso({ tipo: "exito", mensaje: `Ingreso registrado: ${quien}` });
              setTexto("");
              setCodigo(null);
              campo.current?.focus();
            },
            // El servidor manda: su mensaje (ya utilizada, fuera de horario…); la entrada se vuelve a pedir.
            onError: (error) => {
              if (esEventoInexistente(error)) {
                salirPorEventoInexistente();
                return;
              }
              setAviso({
                tipo: "error",
                mensaje:
                  error instanceof ErrorDeApi ? error.mensaje : "No se pudo registrar. Probá de nuevo.",
              });
            },
          });
        },
      },
    ]);
  };

  return (
    <View style={estilos.pantalla}>
      <PantallaDesplazable separacion={tema.espacio.normal}>
        <BuscadorDeCodigo texto={texto} alCambiar={setTexto} alBuscar={buscar} refCampo={campo} />
        {aviso && (
          <Text
            style={aviso.tipo === "exito" ? estilos.exito : estilos.error}
            accessibilityLiveRegion="polite"
          >
            {aviso.mensaje}
          </Text>
        )}
        {codigo !== null && (
          <ResultadoDeIngreso consulta={consulta} enCurso={registrar.isPending} alRegistrar={alRegistrar} />
        )}
      </PantallaDesplazable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  exito: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  error: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.error },
});
