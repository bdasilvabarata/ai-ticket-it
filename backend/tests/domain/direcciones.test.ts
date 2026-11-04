import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { direccionesDeRed } from "../../src/config/direcciones";

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:00:00:00:00:00",
    internal,
    cidr: `${address}/24`,
  };
}

function ipv6(address: string): NetworkInterfaceInfo {
  return {
    address,
    netmask: "ffff:ffff:ffff:ffff::",
    family: "IPv6",
    mac: "00:00:00:00:00:00",
    internal: false,
    cidr: `${address}/64`,
    scopeid: 0,
  };
}

describe("direccionesDeRed", () => {
  it("devuelve las IPv4 no internas con el nombre de su interfaz, sin duplicados", () => {
    expect(
      direccionesDeRed({
        lo: [ipv4("127.0.0.1", true)],
        "Wi-Fi": [ipv6("fe80::1"), ipv4("192.168.0.23")],
        Ethernet: [ipv4("10.0.0.5"), ipv4("192.168.0.23")],
      }),
    ).toEqual([
      { direccion: "192.168.0.23", interfaz: "Wi-Fi" },
      { direccion: "10.0.0.5", interfaz: "Ethernet" },
    ]);
  });

  it("devuelve un arreglo vacío sin interfaces", () => {
    expect(direccionesDeRed({})).toEqual([]);
  });
});
