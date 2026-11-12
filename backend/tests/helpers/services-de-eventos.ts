import type { Categoria } from "../../src/domain/categoria";
import type { Compra } from "../../src/domain/compra";
import type { Evento } from "../../src/domain/evento";
import type { Reloj } from "../../src/domain/reloj";
import type { Resenia } from "../../src/domain/resenia";
import type { Usuario } from "../../src/domain/usuario";
import { CategoriaRepository } from "../../src/repositories/categoria.repository";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { ReseniaRepository } from "../../src/repositories/resenia.repository";
import { UsuarioRepository } from "../../src/repositories/usuario.repository";
import { CategoriaService } from "../../src/services/categoria.service";
import { CerrojoPorClave } from "../../src/services/cerrojo-por-clave";
import { EventoService } from "../../src/services/evento.service";
import { ReseniaService } from "../../src/services/resenia.service";
import { TipoEntradaService } from "../../src/services/tipo-entrada.service";
import { UsuarioService } from "../../src/services/usuario.service";
import { diego, lucia, martin, musica, relojFijo, sofia, teatro } from "./eventos";

export interface DatosDeServicesDeEventos {
  eventos?: Evento[];
  compras?: Compra[];
  categorias?: Categoria[];
  usuarios?: Usuario[];
  resenias?: Resenia[];
  reloj?: Reloj;
}

/**
 * Los services de eventos conectados como en `app.ts` (un cerrojo compartido, `TipoEntradaService`
 * sobre `EventoService`, que se apoya en los de categorías, usuarios y reseñas), con repositorios
 * en memoria armados con los datos de cada caso.
 */
export function crearServicesDeEventos({
  eventos = [],
  compras = [],
  categorias = [musica, teatro],
  usuarios = [lucia, martin, sofia, diego],
  resenias = [],
  reloj = relojFijo(),
}: DatosDeServicesDeEventos = {}) {
  const repositorioEventos = new EventoRepository(eventos);
  const repositorioCompras = new CompraRepository(compras);
  const cerrojo = new CerrojoPorClave();
  const repositorioCategorias = new CategoriaRepository(categorias);
  const repositorioUsuarios = new UsuarioRepository(usuarios);
  const repositorioResenias = new ReseniaRepository(resenias);
  const categoriaService = new CategoriaService({ categorias: repositorioCategorias });
  const usuarioService = new UsuarioService({ usuarios: repositorioUsuarios, eventos: repositorioEventos });
  const reseniaService = new ReseniaService({ resenias: repositorioResenias });
  const eventoService = new EventoService({
    eventos: repositorioEventos,
    compras: repositorioCompras,
    categoriaService,
    usuarioService,
    reseniaService,
    cerrojo,
    reloj,
  });
  const tipoEntradaService = new TipoEntradaService({
    eventos: repositorioEventos,
    compras: repositorioCompras,
    eventoService,
    cerrojo,
    reloj,
  });
  return {
    eventoService,
    tipoEntradaService,
    cerrojo,
    repositorioEventos,
    repositorioCompras,
    repositorioCategorias,
    repositorioUsuarios,
    repositorioResenias,
  };
}
