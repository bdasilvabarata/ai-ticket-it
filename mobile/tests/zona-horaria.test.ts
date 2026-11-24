// Guarda de jest.global-setup.js: si la zona no se aplicara, los tests que dicen correr "fuera de
// Buenos Aires" pasarían sin probar nada.
it("la suite corre en America/New_York (UTC−5 en enero, UTC−4 en julio)", () => {
  expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(300);
  expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(240);
});
