export interface RuletaPremioItem {
  id: string;
  label: string;
  tipo: "descuento" | "monto" | "producto" | "postre" | "bebida" | "2x1" | "gratis" | "sorpresa";
  valor: number;
  probabilidad: number; // 0 - 100
  color_hex: string;
  stock_diario: number;
  codigo_prefijo: string;
}

export interface RuletaPublicSector {
  id: string;
  label: string;
  tipo: string;
  color_hex: string;
  sectorIndex?: number;
}

export type SectorItem = RuletaPublicSector;

export interface RuletaConfigData {
  titulo?: string;
  descripcion?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  colorFondo?: string;
  sectores?: SectorItem[];
  limiteDiasReGiro?: number;
  expiracionHoras?: number;
}

export const DEFAULT_RULETA_PREMIOS: RuletaPremioItem[] = [
  {
    id: "p1",
    label: "10% de Descuento",
    tipo: "descuento",
    valor: 10,
    probabilidad: 30,
    color_hex: "#EF4444", // Rojo
    stock_diario: 50,
    codigo_prefijo: "DESC10",
  },
  {
    id: "p2",
    label: "Postre Gratis",
    tipo: "postre",
    valor: 0,
    probabilidad: 20,
    color_hex: "#F59E0B", // Ámbar
    stock_diario: 20,
    codigo_prefijo: "POSTRE",
  },
  {
    id: "p3",
    label: "2x1 en Platos",
    tipo: "2x1",
    valor: 50,
    probabilidad: 15,
    color_hex: "#10B981", // Esmeralda
    stock_diario: 15,
    codigo_prefijo: "2X1",
  },
  {
    id: "p4",
    label: "Bebida de Cortesía",
    tipo: "bebida",
    valor: 0,
    probabilidad: 15,
    color_hex: "#3B82F6", // Azul
    stock_diario: 30,
    codigo_prefijo: "BEBIDA",
  },
  {
    id: "p5",
    label: "15% de Descuento",
    tipo: "descuento",
    valor: 15,
    probabilidad: 10,
    color_hex: "#8B5CF6", // Púrpura
    stock_diario: 10,
    codigo_prefijo: "DESC15",
  },
  {
    id: "p6",
    label: "¡Premio Especial!",
    tipo: "gratis",
    valor: 0,
    probabilidad: 10,
    color_hex: "#EC4899", // Rosa
    stock_diario: 5,
    codigo_prefijo: "ESPECIAL",
  },
];
