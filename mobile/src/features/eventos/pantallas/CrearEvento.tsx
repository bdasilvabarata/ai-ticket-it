import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Boton, PantallaDesplazable, tema } from "../../../componentes";
import { useSesion } from "../../sesion";
import { AvisoDeFormulario } from "../componentes/AvisoDeFormulario";
import { CamposEvento } from "../componentes/CamposEvento";
import { CamposTipoEntrada } from "../componentes/CamposTipoEntrada";
import { MensajeDeCampo } from "../componentes/MensajeDeCampo";
import { erroresDeFormulario, SIN_ERRORES, type ErroresDeFormulario } from "../errores-de-formulario";
import {
  aCuerpoEvento,
  aCuerpoTipo,
  erroresDelTipo,
  mismosValores,
  VALORES_EVENTO_VACIO,
  VALORES_TIPO_VACIO,
  type ValoresEvento,
  type ValoresTipoEntrada,
} from "../formulario";
import { useCrearEvento } from "../mutaciones";
import { useConfirmarDescarte } from "../useConfirmarDescarte";

/** Una tarjeta de tipo de entrada; `clave` es local, para la lista. */
interface FilaTipo extends ValoresTipoEntrada {
  clave: number;
}

/** Crear evento (contracts/app.md, "Crear evento"; US1). */
export function CrearEvento() {
  const { estado } = useSesion();
  if (estado.fase !== "con-usuario") return null; // el guard ya no muestra esta ruta
  return <FormularioCrearEvento usuarioId={estado.usuarioId} />;
}

function FormularioCrearEvento({ usuarioId }: { usuarioId: string }) {
  const [valores, setValores] = useState<ValoresEvento>(VALORES_EVENTO_VACIO);
  const [tipos, setTipos] = useState<FilaTipo[]>([{ clave: 0, ...VALORES_TIPO_VACIO }]);
  const [errores, setErrores] = useState<ErroresDeFormulario>(SIN_ERRORES);
  const siguienteClave = useRef(1);
  const crear = useCrearEvento(usuarioId);
  const hayCambios =
    !mismosValores(valores, VALORES_EVENTO_VACIO) ||
    !mismosValores(
      tipos.map(({ nombre, descripcion, precio, cupo }) => ({ nombre, descripcion, precio, cupo })),
      [VALORES_TIPO_VACIO],
    );
  const { salirSinConfirmar } = useConfirmarDescarte({ hayCambios });

  const cambiar = (cambios: Partial<ValoresEvento>) =>
    setValores((actuales) => ({ ...actuales, ...cambios }));
  const cambiarTipo = (clave: number, cambios: Partial<ValoresTipoEntrada>) =>
    setTipos((actuales) => actuales.map((tipo) => (tipo.clave === clave ? { ...tipo, ...cambios } : tipo)));

  function agregarTipo() {
    const clave = siguienteClave.current;
    siguienteClave.current += 1;
    setTipos((actuales) => [...actuales, { clave, ...VALORES_TIPO_VACIO }]);
  }

  function guardar() {
    setErrores(SIN_ERRORES);
    crear.mutate(
      { ...aCuerpoEvento(valores), tiposEntrada: tipos.map(aCuerpoTipo) },
      {
        onSuccess: () => salirSinConfirmar(() => router.dismissTo("/mis-eventos")),
        onError: (error) => setErrores(erroresDeFormulario(error, "evento")),
      },
    );
  }

  return (
    <PantallaDesplazable>
      <CamposEvento valores={valores} alCambiar={cambiar} errores={errores.campos} />

      <View accessibilityLabel="Tipos de entrada" style={estilos.seccion}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Tipos de entrada
        </Text>
        <MensajeDeCampo mensaje={errores.campos.tiposEntrada} />
        {tipos.map((tipo, i) => (
          <View key={tipo.clave} accessibilityLabel={`Tipo de entrada ${i + 1}`} style={estilos.tarjeta}>
            <View style={estilos.encabezadoTarjeta}>
              <Text style={estilos.subtitulo}>{`Tipo ${i + 1}`}</Text>
              <Boton
                variante="texto"
                texto="Quitar"
                accessibilityLabel={`Quitar tipo ${i + 1}`}
                deshabilitado={tipos.length === 1}
                alPresionar={() => setTipos((actuales) => actuales.filter((t) => t.clave !== tipo.clave))}
              />
            </View>
            <CamposTipoEntrada
              numero={i + 1}
              valores={tipo}
              alCambiar={(cambios) => cambiarTipo(tipo.clave, cambios)}
              errores={erroresDelTipo(errores.campos, i)}
            />
          </View>
        ))}
        <Boton variante="texto" texto="Agregar otro tipo de entrada" alPresionar={agregarTipo} />
      </View>

      <AvisoDeFormulario mensaje={errores.mensajeGeneral} />
      <Boton texto="Crear evento" textoEnCurso="Creando…" enCurso={crear.isPending} alPresionar={guardar} />
    </PantallaDesplazable>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: tema.espacio.medio },
  titulo: { ...tema.tipografia.subtitulo, color: tema.colores.texto },
  tarjeta: {
    gap: tema.espacio.medio,
    padding: tema.espacio.normal,
    borderRadius: tema.radio.tarjeta,
    borderWidth: tema.grosor.normal,
    borderColor: tema.colores.borde,
    backgroundColor: tema.colores.superficie,
    boxShadow: tema.sombra.nivel1,
  },
  encabezadoTarjeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subtitulo: { ...tema.tipografia.tituloTarjeta, color: tema.colores.texto },
});
