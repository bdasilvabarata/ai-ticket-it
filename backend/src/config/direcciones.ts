import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

/** IPv4 no internas de la máquina, sin duplicados: las que sirven desde otro dispositivo de la red. */
export function direccionesDeRed(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string[] {
  const direcciones = Object.values(interfaces)
    .flatMap((lista) => lista ?? [])
    .filter((info) => info.family === "IPv4" && !info.internal)
    .map((info) => info.address);
  return [...new Set(direcciones)];
}
