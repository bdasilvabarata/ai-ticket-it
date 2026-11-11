import type { Categoria } from "../../src/domain/categoria";
import type { Compra } from "../../src/domain/compra";
import type { Evento } from "../../src/domain/evento";
import type { Reloj } from "../../src/domain/reloj";
import { CategoriaRepository } from "../../src/repositories/categoria.repository";
import { CompraRepository } from "../../src/repositories/compra.repository";
import { EventoRepository } from "../../src/repositories/evento.repository";
import { CategoriaService } from "../../src/services/categoria.service";
import { CerrojoPorClave } from "../../src/services/cerrojo-por-clave";
import { EventoService } from "../../src/services/evento.service";
import { TipoEntradaService } from "../../src/services/tipo-entrada.service";
import { musica, relojFijo, teatro } from "./eventos";

export interface DatosDeServicesDeEventos {
  eventos?: Evento[];
  compras?: Compra[];
  categorias?: Categoria[];
  reloj?: Reloj;
}

/**
 * Los services de eventos conectados como en `app.ts` (un cerrojo compartido, `TipoEntradaService`
 * sobre `EventoService`), con repositorios en memoria armados con los datos de cada caso.
 */
export function crearServicesDeEventos({
  eventos = [],
  compras = [],
  categorias = [musica, teatro],
  reloj = relojFijo(),
}: DatosDeServicesDeEventos = {}) {
  const repositorioEventos = new EventoRepository(eventos);
  const repositorioCompras = new CompraRepository(compras);
  const cerrojo = new CerrojoPorClave();
  const categoriaService = new CategoriaService({ categorias: new CategoriaRepository(categorias) });
  const eventoService = new EventoService({
    eventos: repositorioEventos,
    compras: repositorioCompras,
    categoriaService,
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
  return { eventoService, tipoEntradaService, cerrojo, repositorioEventos, repositorioCompras };
}
