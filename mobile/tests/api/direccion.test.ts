import { resolverUrlBase } from "../../src/api";

describe("resolverUrlBase", () => {
  it("usa la variable de entorno sin la barra final, haya hostUri o no", () => {
    expect(resolverUrlBase({ urlEntorno: "http://10.0.0.5:3000/api/", hostUri: "192.168.0.23:8081" })).toBe(
      "http://10.0.0.5:3000/api",
    );
    expect(resolverUrlBase({ urlEntorno: "http://10.0.0.5:3000/api/" })).toBe("http://10.0.0.5:3000/api");
  });

  it("sin variable de entorno, toma el host de Expo con el puerto del servidor", () => {
    expect(resolverUrlBase({ hostUri: "192.168.0.23:8081" })).toBe("http://192.168.0.23:3000/api");
    expect(resolverUrlBase({ urlEntorno: "", hostUri: "192.168.0.23:8081" })).toBe(
      "http://192.168.0.23:3000/api",
    );
  });

  it("una variable de entorno de solo espacios cuenta como vacía", () => {
    expect(resolverUrlBase({ urlEntorno: "   ", hostUri: "192.168.0.23:8081" })).toBe(
      "http://192.168.0.23:3000/api",
    );
  });

  it("sin nada, usa localhost", () => {
    expect(resolverUrlBase({})).toBe("http://localhost:3000/api");
    expect(resolverUrlBase({ urlEntorno: undefined, hostUri: null })).toBe("http://localhost:3000/api");
  });
});
