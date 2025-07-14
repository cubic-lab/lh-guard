export interface Metrics {
  generatedAt: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
}

export type LHConfig = Record<
  string, 
  Record<string, {url: string; domainRotation: boolean}
>>
