import type { EventoVista, TipoEntradaVista } from "@ai-ticket-it/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Boton, PantallaDesplazable, tema } from "../../../componentes";
import { AvisoDeFormulario } from "../componentes/AvisoDeFormulario";
import { CamposEvento } from "../componentes/CamposEvento";
import { ListaTiposEntrada } from "../componentes/ListaTiposEntrada";
import {
  erroresDeFormulario,
  esNoEncontrado,
  SIN_ERRORES,
  type ErroresDeFormulario,
} from "../errores-de-formulario";
import { aCuerpoEvento, mismosValores, valoresDeEvento, type ValoresEvento } from "../formulario";
import { useActualizarEvento, useEliminarEvento, useQuitarTipoEntrada } from "../mutaciones";
import { useConfirmarDescarte } from "../useConfirmarDescarte";

const AVISO_NO_EXISTE = "El evento ya no existe.";

/**
 * Editar un evento no realizado (contracts/app.md, "Editar evento"; US3 y US4): sus datos, sus tipos
 * de a uno y eliminarlo. Un 409 `EVENTO_REALIZADO` no se maneja acá: la invalidación vuelve a pedir
 * el evento y `EventoDelOrganizador` pasa a solo lectura.
 */
export function EditarEvento({ evento, usuarioId }: { evento: EventoVista; usuarioId: string }) {
  // Lo cargado al abrir: los cambios se miden contra esto (los tipos se guardan en su propia pantalla).
  const [iniciales] = useState<ValoresEvento>(() => valoresDeEvento(evento));
  const [valores, setValores] = useState<ValoresEvento>(iniciales);
  const [errores, setErrores] = useState<ErroresDeFormulario>(SIN_ERRORES);
  const [avisoTipos, setAvisoTipos] = useState<string | null>(null);
  const [avisoEliminar, setAvisoEliminar] = useState<string | null>(null);
  const actualizar = useActualizarEvento(usuarioId, evento.id);
  const quitar = useQuitarTipoEntrada(usuarioId, evento.id);
  const eliminar = useEliminarEvento(usuarioId, evento.id);
  const { salirSinConfirmar } = useConfirmarDescarte({ hayCambios: !mismosValores(valores, iniciales) });

  const volverAMisEventos = () => salirSinConfirmar(() => router.dismissTo("/mis-eventos"));

  /** Un 404 avisa y vuelve a Mis eventos (US3-11); el resto lo muestra `mostrar`. */
  const alFallar = (mostrar: (error: unknown) => void) => (error: unknown) => {
    if (esNoEncontrado(error)) {
      Alert.alert(AVISO_NO_EXISTE);
      volverAMisEventos();
    } else {
      mostrar(error);
    }
  };
  const mensajeDe = (error: unknown) => erroresDeFormulario(error, "evento").mensajeGeneral;

  function guardar() {
    setErrores(SIN_ERRORES);
    actualizar.mutate(aCuerpoEvento(valores), {
      onSuccess: volverAMisEventos,
      onError: alFallar((error) => setErrores(erroresDeFormulario(error, "evento"))),
    });
  }

  function confirmarQuitar(tipo: TipoEntradaVista) {
    Alert.alert(`¿Quitar ${tipo.nombre}?`, undefined, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () => {
          setAvisoTipos(null);
          quitar.mutate(tipo.id, { onError: alFallar((error) => setAvisoTipos(mensajeDe(error))) });
        },
      },
    ]);
  }

  function confirmarEliminar() {
    Alert.alert(`¿Eliminar "${evento.nombre}"?`, "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => {
          setAvisoEliminar(null);
          eliminar.mutate(undefined, {
            onSuccess: volverAMisEventos,
            onError: alFallar((error) => setAvisoEliminar(mensajeDe(error))),
          });
        },
      },
    ]);
  }

  const irATipo = (tipo: TipoEntradaVista) =>
    router.push({
      pathname: "/eventos/[eventoId]/tipos-entrada/[tipoEntradaId]",
      params: { eventoId: evento.id, tipoEntradaId: tipo.id },
    });

  return (
    <PantallaDesplazable>
      <View style={estilos.seccion}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Datos del evento
        </Text>
        <CamposEvento
          valores={valores}
          alCambiar={(cambios) => setValores((actuales) => ({ ...actuales, ...cambios }))}
          errores={errores.campos}
        />
        <AvisoDeFormulario mensaje={errores.mensajeGeneral} />
        <Boton
          texto="Guardar cambios"
          textoEnCurso="Guardando…"
          enCurso={actualizar.isPending}
          alPresionar={guardar}
        />
      </View>

      <View style={estilos.seccion}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Tipos de entrada
        </Text>
        <AvisoDeFormulario mensaje={avisoTipos} />
        <ListaTiposEntrada
          tipos={evento.tiposEntrada}
          acciones={{
            alEditar: irATipo,
            alQuitar: confirmarQuitar,
            alAgregar: () =>
              router.push({
                pathname: "/eventos/[eventoId]/tipos-entrada/nuevo",
                params: { eventoId: evento.id },
              }),
            ocupada: quitar.isPending,
          }}
        />
      </View>

      <View style={estilos.seccion}>
        <AvisoDeFormulario mensaje={avisoEliminar} />
        <Boton
          variante="aviso"
          texto="Eliminar evento"
          textoEnCurso="Eliminando…"
          enCurso={eliminar.isPending}
          alPresionar={confirmarEliminar}
        />
      </View>
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: tema.espacio.medio },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
});
