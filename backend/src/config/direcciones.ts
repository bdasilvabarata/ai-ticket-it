import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

export interface DireccionDeRed {
  direccion: string;
  /** Nombre de la interfaz (ej.: "Wi-Fi"): ayuda a distinguir la real de las virtuales. */
  interfaz: string;
}

/** IPv4 no internas de la máquina, sin duplicados: las que sirven desde otro dispositivo de la red. */
export function direccionesDeRed(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): DireccionDeRed[] {
  const vistas = new Set<string>();
  const resultado: DireccionDeRed[] = [];
  for (const [interfaz, lista] of Object.entries(interfaces)) {
    for (const info of lista ?? []) {
      if (info.family !== "IPv4" || info.internal || vistas.has(info.address)) continue;
      vistas.add(info.address);
      resultado.push({ direccion: info.address, interfaz });
    }
  }
  return resultado;
}
