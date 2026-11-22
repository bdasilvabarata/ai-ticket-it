import { describe, expect, it } from "vitest";
import { Resenia } from "../../src/domain/resenia";
import {
  aReseniaDelOrganizadorVista,
  aReseniasDelOrganizadorVista,
  aReseniaVista,
} from "../../src/services/resenia.vistas";
import { diego, evento, martin, sofia } from "../helpers/eventos";

const jazz = evento({ id: "evento-jazz", nombre: "Jazz en el Patio", organizadorId: martin.id });
// 01:30 UTC son las 22:30 del día anterior en Buenos Aires (UTC−3).
const deDiego = new Resenia({
  id: "resenia-diego-jazz",
  compradorId: diego.id,
  eventoId: jazz.id,
  puntuacion: 4,
  comentario: "Muy buena",
  creadaEn: new Date("2026-11-11T01:30:00.000Z"),
});
const deSofia = new Resenia({
  id: "resenia-sofia-jazz",
  compradorId: sofia.id,
  eventoId: jazz.id,
  puntuacion: 5,
  comentario: null,
  creadaEn: new Date("2026-11-09T12:00:00.000Z"),
});

describe("aReseniaVista (feature 012)", () => {
  it("creadaEn ISO UTC y creadaEnLocal de Buenos Aires (el día anterior a la noche)", () => {
    expect(aReseniaVista(deDiego)).toEqual({
      id: "resenia-diego-jazz",
      eventoId: "evento-jazz",
      puntuacion: 4,
      comentario: "Muy buena",
      creadaEn: "2026-11-11T01:30:00.000Z",
      creadaEnLocal: "2026-11-10T22:30",
    });
  });

  it("un comentario null se mantiene null, y no expone el compradorId", () => {
    const vista = aReseniaVista(deSofia);
    expect(vista.comentario).toBeNull();
    expect(Object.keys(vista).sort()).toEqual([
      "comentario",
      "creadaEn",
      "creadaEnLocal",
      "eventoId",
      "id",
      "puntuacion",
    ]);
  });
});

describe("aReseniaDelOrganizadorVista", () => {
  it("autor sin id, evento con id y nombre, y las fechas", () => {
    const vista = aReseniaDelOrganizadorVista(deDiego, diego, jazz);
    expect(vista).toEqual({
      id: "resenia-diego-jazz",
      puntuacion: 4,
      comentario: "Muy buena",
      autor: { nombre: "Diego", apellido: "Fernández" },
      evento: { id: "evento-jazz", nombre: "Jazz en el Patio" },
      creadaEn: "2026-11-11T01:30:00.000Z",
      creadaEnLocal: "2026-11-10T22:30",
    });
    expect(Object.keys(vista.autor).sort()).toEqual(["apellido", "nombre"]);
    expect(Object.keys(vista.evento).sort()).toEqual(["id", "nombre"]);
  });
});

describe("aReseniasDelOrganizadorVista", () => {
  const organizador = {
    id: martin.id,
    nombre: "Martín",
    apellido: "Benítez",
    puntaje: 4.5,
    cantidadResenias: 2,
  };
  const usuarios = new Map([
    [diego.id, diego],
    [sofia.id, sofia],
    [martin.id, martin],
  ]);
  const eventos = new Map([[jazz.id, jazz]]);

  it("el organizador tal cual y las reseñas en el orden recibido, sin datos de compras (FR-016)", () => {
    const vista = aReseniasDelOrganizadorVista(organizador, [deSofia, deDiego], usuarios, eventos);
    expect(Object.keys(vista).sort()).toEqual(["organizador", "resenias"]);
    expect(vista.organizador).toEqual(organizador);
    expect(vista.resenias.map((r) => r.id)).toEqual(["resenia-sofia-jazz", "resenia-diego-jazz"]);
    expect(vista.resenias[0]!.autor).toEqual({ nombre: "Sofía", apellido: "Castro" });
    const json = JSON.stringify(vista);
    expect(json).not.toContain("compradorId");
    expect(json).not.toContain(diego.id);
    for (const r of vista.resenias) {
      expect(Object.keys(r).sort()).toEqual([
        "autor",
        "comentario",
        "creadaEn",
        "creadaEnLocal",
        "evento",
        "id",
        "puntuacion",
      ]);
    }
  });

  it("sin reseñas, resenias vacía", () => {
    const sinNada = { ...organizador, puntaje: null, cantidadResenias: 0 };
    expect(aReseniasDelOrganizadorVista(sinNada, [], usuarios, eventos)).toEqual({
      organizador: sinNada,
      resenias: [],
    });
  });
});
