export interface PropsFranjaServidorNoDisponible {
  urlBase: string;
  reintentando: boolean;
  alReintentar: () => void;
}

/** Stub de T049: la implementación llega en T053. */
export function FranjaServidorNoDisponible(props: PropsFranjaServidorNoDisponible) {
  void props;
  return null;
}
