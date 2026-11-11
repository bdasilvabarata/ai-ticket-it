/**
 * Zona horaria de toda la suite. Se fija acá, antes de que Jest cree los workers: cambiar
 * `process.env.TZ` adentro de un test no cambia la zona del proceso (Jest le da a cada archivo una
 * copia de `process.env`), así que un test que la cambiaba pasaba sin probar nada. Nueva York es
 * distinta de Buenos Aires y tiene horario de verano: lo que no dependa de la zona del teléfono
 * tiene que andar acá. `tests/zona-horaria.test.ts` verifica que se aplicó.
 */
module.exports = () => {
  process.env.TZ = "America/New_York";
};
