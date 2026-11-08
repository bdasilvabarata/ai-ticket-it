/** @type {import("jest").Config} */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/**/*.test.ts?(x)"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // El preset ya mockea APIs como `AccessibilityInfo.announceForAccessibility`; `jest.spyOn` sobre
  // un mock existente devuelve el mismo mock, así que sin esto acumularía llamadas de otros tests.
  clearMocks: true,
};
