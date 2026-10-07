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
  meta: { area: string; month: string; asOf: string; source: string; actualLabel?: string };
  areas: MongkolArea[];
  indySummary: { count: number; noSale: number; atRisk: number; watch: number; onTrack: number };
  indies: MongkolIndy[];
};

export type MongkolIndy = {
  firstName: string;
  lastName: string;
  employeeType: string;
  shopCode: string;
  shopName: string;
  shopType: string;
  target: number;
  daily: number[];
  actual: number;
  achievement: number;
};
