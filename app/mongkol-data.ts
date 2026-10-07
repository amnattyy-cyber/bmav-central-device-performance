export type MongkolArea = {
  area: string;
  branch: string;
  target: number;
  daily: Array<number | null>;
  actual: number;
  achievement: number;
  rrEndMonth: number;
  noSaleCount: number;
  indyCount: number;
};

export type MongkolData = {
  meta: { area: string; month: string; asOf: string; source: string };
  areas: MongkolArea[];
  indySummary: { count: number; noSale: number; atRisk: number; watch: number; onTrack: number };
};
