import { EstadoCompra } from "@ai-ticket-it/shared";

describe("@ai-ticket-it/shared", () => {
  it("se importa como valor desde la app (Jest transforma el TypeScript del workspace)", () => {
    expect(EstadoCompra.CONFIRMADA).toBe("CONFIRMADA");
  });
});
