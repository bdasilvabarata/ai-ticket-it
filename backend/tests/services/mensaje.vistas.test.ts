import { EstadoCompra } from "@ai-ticket-it/shared";
import { describe, expect, it } from "vitest";
import { Mensaje } from "../../src/domain/compra";
import { aChatDeLaCompraVista, aMensajeVista } from "../../src/services/mensaje.vistas";
import { AHORA, compra, evento, lucia, martin, tipo } from "../helpers/eventos";

const MINUTO = 60 * 1000;
const despues = (minutos: number) => new Date(AHORA.getTime() + minutos * MINUTO);

const festival = evento({
  id: "evento-festival",
  nombre: "Festival Sonidos del Sur",
  organizadorId: lucia.id,
  tiposEntrada: [tipo({ id: "tipo-festival-vip", nombre: "VIP" })],
});
const mensajes = [
  new Mensaje({ autorId: martin.id, texto: "Hola, ¿incluye estacionamiento?", enviadoEn: despues(10) }),
  // 23:30 UTC son las 20:30 de Buenos Aires (UTC−3).
  new Mensaje({
    autorId: lucia.id,
    texto: "¡Hola, Martín!\nSí.",
    enviadoEn: new Date("2026-11-10T23:30:00.000Z"),
  }),
];
const compraDeMartin = compra("evento-festival", "tipo-festival-vip", EstadoCompra.CONFIRMADA, {
  id: "compra-martin-festival-vip",
  cantidad: 2,
  mensajes,
});
const usuarios = new Map([
  [martin.id, martin],
  [lucia.id, lucia],
]);

describe("aMensajeVista (feature 011, R6)", () => {
  it("numero, autor con su rol, texto, enviadoEn ISO UTC y enviadoEnLocal de Buenos Aires", () => {
    expect(aMensajeVista(mensajes[1]!, 2, compraDeMartin, festival, lucia)).toEqual({
      numero: 2,
      autor: { id: lucia.id, nombre: "Lucía", apellido: "Álvarez", rol: "organizador" },
      texto: "¡Hola, Martín!\nSí.",
      enviadoEn: "2026-11-10T23:30:00.000Z",
      enviadoEnLocal: "2026-11-10T20:30",
    });
  });

  it("el comprador lleva rol comprador", () => {
    expect(aMensajeVista(mensajes[0]!, 1, compraDeMartin, festival, martin).autor).toEqual({
      id: martin.id,
      nombre: "Martín",
      apellido: "Benítez",
      rol: "comprador",
    });
  });

  it("tiene exactamente las claves de MensajeVista", () => {
    const vista = aMensajeVista(mensajes[0]!, 1, compraDeMartin, festival, martin);
    expect(Object.keys(vista).sort()).toEqual(["autor", "enviadoEn", "enviadoEnLocal", "numero", "texto"]);
    expect(Object.keys(vista.autor).sort()).toEqual(["apellido", "id", "nombre", "rol"]);
  });
});

describe("aChatDeLaCompraVista (feature 011, R6)", () => {
  it("el encabezado de la compra, la otra parte y los mensajes numerados desde 1, en orden", () => {
    const vista = aChatDeLaCompraVista(compraDeMartin, festival, usuarios, martin.id);

    expect(vista.compra).toEqual({
      id: "compra-martin-festival-vip",
      evento: { id: "evento-festival", nombre: "Festival Sonidos del Sur" },
      tipoEntrada: { id: "tipo-festival-vip", nombre: "VIP" },
      cantidad: 2,
      estado: EstadoCompra.CONFIRMADA,
    });
    expect(vista.mensajes.map((m) => [m.numero, m.autor.rol, m.texto])).toEqual([
      [1, "comprador", "Hola, ¿incluye estacionamiento?"],
      [2, "organizador", "¡Hola, Martín!\nSí."],
    ]);
  });

  it("otraParte es el organizador para el comprador y el comprador para el organizador", () => {
    expect(aChatDeLaCompraVista(compraDeMartin, festival, usuarios, martin.id).otraParte).toEqual({
      id: lucia.id,
      nombre: "Lucía",
      apellido: "Álvarez",
      rol: "organizador",
    });
    expect(aChatDeLaCompraVista(compraDeMartin, festival, usuarios, lucia.id).otraParte).toEqual({
      id: martin.id,
      nombre: "Martín",
      apellido: "Benítez",
      rol: "comprador",
    });
  });

  it("el estado es el de la compra recibida (el service la pasa al día)", () => {
    const vencida = compra("evento-festival", "tipo-festival-vip", EstadoCompra.PENDIENTE).alDia(despues(15));
    expect(aChatDeLaCompraVista(vencida, festival, usuarios, martin.id).compra.estado).toBe(
      EstadoCompra.CANCELADA,
    );
  });

  it("sin mensajes, un arreglo vacío", () => {
    const sinMensajes = compra("evento-festival", "tipo-festival-vip");
    expect(aChatDeLaCompraVista(sinMensajes, festival, usuarios, martin.id).mensajes).toEqual([]);
  });

  it("tiene exactamente las claves de ChatDeLaCompraVista: sin entradas, historial, total ni compradorId", () => {
    const vista = aChatDeLaCompraVista(compraDeMartin, festival, usuarios, martin.id);

    expect(Object.keys(vista).sort()).toEqual(["compra", "mensajes", "otraParte"]);
    expect(Object.keys(vista.compra).sort()).toEqual(["cantidad", "estado", "evento", "id", "tipoEntrada"]);
    expect(Object.keys(vista.compra.evento).sort()).toEqual(["id", "nombre"]);
    expect(Object.keys(vista.compra.tipoEntrada).sort()).toEqual(["id", "nombre"]);
    const json = JSON.stringify(vista);
    for (const entrada of compraDeMartin.entradas) expect(json).not.toContain(entrada.codigo);
  });
});
