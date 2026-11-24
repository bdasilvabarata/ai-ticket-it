import type { ChatDeLaCompraVista, MensajeVista, ParteDeLaCompraVista } from "@ai-ticket-it/shared";
import type { Compra, Mensaje } from "../domain/compra";
import type { Evento } from "../domain/evento";
import { horaDeBuenosAires } from "../domain/hora-buenos-aires";
import type { Usuario } from "../domain/usuario";
import { aTipoDeLaCompra } from "./compra.vistas";

// Vistas explícitas del chat de una compra (feature 011, R6; principio V): sin códigos de entradas,
// historial, total ni `compradorId`.

/** Una de las dos partes con su rol en la compra. El service ya verificó que lo sea (R2). */
function aParteDeLaCompraVista(usuario: Usuario, compra: Compra, evento: Evento): ParteDeLaCompraVista {
  const rol = compra.rolDe(usuario.id, evento.organizadorId);
  if (rol === null) throw new Error(`${usuario.id} no es parte de la compra ${compra.id}.`);
  return { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, rol };
}

/** El usuario con ese id del lote, que el service pidió con las dos partes. */
function usuarioDelLote(usuarios: Map<string, Usuario>, usuarioId: string): Usuario {
  const usuario = usuarios.get(usuarioId);
  if (!usuario) throw new Error(`Falta el usuario ${usuarioId} en el lote.`);
  return usuario;
}

/** Un mensaje en la posición `numero` (desde 1), con su autor y su rol. */
export function aMensajeVista(
  mensaje: Mensaje,
  numero: number,
  compra: Compra,
  evento: Evento,
  autor: Usuario,
): MensajeVista {
  return {
    numero,
    autor: aParteDeLaCompraVista(autor, compra, evento),
    texto: mensaje.texto,
    enviadoEn: mensaje.enviadoEn.toISOString(),
    enviadoEnLocal: horaDeBuenosAires(mensaje.enviadoEn),
  };
}

/**
 * El chat visto por `usuarioId` (una de las dos partes): el encabezado de la compra (que llega al
 * día), la otra parte y todos los mensajes en orden. `usuarios` trae al comprador y al organizador.
 */
export function aChatDeLaCompraVista(
  compra: Compra,
  evento: Evento,
  usuarios: Map<string, Usuario>,
  usuarioId: string,
): ChatDeLaCompraVista {
  const otraParteId = usuarioId === compra.compradorId ? evento.organizadorId : compra.compradorId;
  return {
    compra: {
      id: compra.id,
      evento: { id: evento.id, nombre: evento.nombre },
      tipoEntrada: aTipoDeLaCompra(compra, evento),
      cantidad: compra.cantidad,
      estado: compra.estado,
    },
    otraParte: aParteDeLaCompraVista(usuarioDelLote(usuarios, otraParteId), compra, evento),
    mensajes: compra.mensajes.map((mensaje, i) =>
      aMensajeVista(mensaje, i + 1, compra, evento, usuarioDelLote(usuarios, mensaje.autorId)),
    ),
  };
}
