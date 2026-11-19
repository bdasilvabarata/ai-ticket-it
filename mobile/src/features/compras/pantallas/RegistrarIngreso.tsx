import type { EntradaDelEventoVista } from "@ai-ticket-it/shared";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Alert, StyleSheet, Text, View, type TextInput } from "react-native";

import { ErrorDeApi } from "../../../api";
import { Boton, PantallaDesplazable, SegunConsulta, tema } from "../../../componentes";
import { CampoDeTexto } from "../../eventos";
import { useSesion } from "../../sesion";
import { TarjetaEntrada } from "../componentes/TarjetaEntrada";
import {
  esEventoInexistente,
  salirPorEventoInexistente,
  useSalirSiNoExisteElEvento,
} from "../evento-inexistente";
import { normalizarCodigo, textoMotivoNoUsable } from "../formato";
import { useRegistrarUso } from "../mutaciones";
import { useEntradaDelEvento } from "../useEntradaDelEvento";

/**
 * "Registrar ingreso" (feature 008, US3; contracts/app.md): el organizador ingresa el código de una
 * entrada, ve de quién es y, si se puede usar, registra el ingreso tras confirmarlo. Se llega desde
 * "Compras del evento"; el permiso y la ventana los decide el servidor.
 */
export function RegistrarIngreso() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <Ingreso usuarioId={estado.usuarioId} eventoId={eventoId} />;
}

type Aviso = { tipo: "exito" | "error"; mensaje: string };

const NO_ENCONTRADA = "ENTRADA_NO_ENCONTRADA";

function Ingreso({ usuarioId, eventoId }: { usuarioId: string; eventoId: string }) {
  const [texto, setTexto] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const consulta = useEntradaDelEvento(usuarioId, eventoId, codigo);
  const registrar = useRegistrarUso(usuarioId, eventoId);
  const normalizado = normalizarCodigo(texto);
  useSalirSiNoExisteElEvento(consulta.error);

  const buscar = () => {
    setAviso(null);
    // El mismo código otra vez vuelve a pedirlo (su estado pudo cambiar).
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

  const noEncontrada = consulta.error instanceof ErrorDeApi && consulta.error.codigo === NO_ENCONTRADA;

  return (
    <View style={estilos.pantalla}>
      <PantallaDesplazable separacion={tema.espacio.normal}>
        <CampoDeTexto
          ref={campo}
          etiqueta="Código de la entrada"
          valor={texto}
          alCambiar={setTexto}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
        />
        <Boton texto="Buscar" deshabilitado={normalizado === ""} alPresionar={buscar} />
        {aviso ? (
          <Text
            style={aviso.tipo === "exito" ? estilos.exito : estilos.error}
            accessibilityLiveRegion="polite"
          >
            {aviso.mensaje}
          </Text>
        ) : null}
        {codigo === null ? null : noEncontrada ? (
          <Text style={estilos.error} accessibilityLiveRegion="polite">
            No hay ninguna entrada con ese código en este evento.
          </Text>
        ) : (
          <SegunConsulta
            consulta={consulta}
            mensajeVacio="No hay ninguna entrada con ese código en este evento."
          >
            {(entrada) => (
              <View style={estilos.resultado}>
                <TarjetaEntrada entrada={entrada} />
                <Accion entrada={entrada} enCurso={registrar.isPending} alRegistrar={alRegistrar} />
              </View>
            )}
          </SegunConsulta>
        )}
      </PantallaDesplazable>
    </View>
  );
}

/** "Registrar ingreso" si la entrada se puede usar; si no, el motivo en su lugar (FR-019). */
function Accion({
  entrada,
  enCurso,
  alRegistrar,
}: {
  entrada: EntradaDelEventoVista;
  enCurso: boolean;
  alRegistrar: (entrada: EntradaDelEventoVista) => void;
}) {
  const motivo = textoMotivoNoUsable(entrada);
  if (motivo !== null) {
    return (
      <Text style={estilos.motivo} accessibilityLiveRegion="polite">
        {motivo}
      </Text>
    );
  }
  return (
    <Boton
      texto="Registrar ingreso"
      textoEnCurso="Registrando…"
      enCurso={enCurso}
      alPresionar={() => alRegistrar(entrada)}
    />
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.colores.fondo },
  resultado: { gap: tema.espacio.normal },
  motivo: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  exito: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.texto },
  error: { ...tema.tipografia.cuerpoFuerte, color: tema.colores.error },
});
