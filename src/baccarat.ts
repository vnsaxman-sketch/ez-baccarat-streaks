export const N_DECKS = 8;
export const CUT_CARD_MIN = 68;
export const CUT_CARD_MAX = 80;

export const CLASS_C: [number, number] = [0.45, 0.55];
export const CLASS_D: [number, number] = [0.35, 0.45];
export const CLASS_BD: [number, number] = [0.55, 0.7];

export type Outcome = "P" | "B" | "T";
export type ShoeClass = "C" | "D" | "B/D" | null;
export type Histogram = Record<number, number>;

export interface ShoeResult {
  full: Outcome[];
  nontie: Exclude<Outcome, "T">[];
  lens: number[];
  S: number;
  R: number;
  cls: ShoeClass;
  hist: Histogram;
  T: number;
  N: number;
}

export interface Summary {
  [key: string]: number;
  N_shoes: number;
  S_mean: number;
  S_sd: number;
  R_mean: number;
  R_sd: number;
  T_mean: number;
  T_sd: number;
  N_mean: number;
  N_sd: number;
}

export interface ClassSummary extends Summary {
  count: number;
}

export interface VerificationResult {
  name: string;
  className: string;
  S: string;
  L1: string;
  L2: string;
  L3: string;
  L4: string;
  L5plus: string;
  zS: string;
  zL1: string;
  verdict: "PASS" | "MOSTLY OK" | "FAIL" | "N/A";
  notes: string;
}

export const REFERENCE_TABLE = [
  ["C1 (textbook)", 33, 0.508, 16, 9, 4, 2, 2, 6, "C"],
  ["C2 (single-rich)", 35, 0.538, 19, 9, 4, 2, 1, 5, "C"],
  ["C3 (streak-rich)", 30, 0.462, 13, 8, 4, 2, 3, 5, "C"],
  ["BD1 (choppy)", 41, 0.631, 27, 9, 3, 1, 1, 5, "B/D"],
  ["BD2 (extreme chop)", 45, 0.692, 32, 8, 3, 1, 0, 4, "B/D"],
] as const;

type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

class SeededRandom {
  private state: number;

  constructor(seed = 12345) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

function shuffle<T>(items: T[], rng: SeededRandom): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function newShoe(rng: SeededRandom): Rank[] {
  const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  return shuffle(Array.from({ length: N_DECKS * 4 }, () => ranks).flat(), rng);
}

function cardValue(rank: Rank): number {
  if (rank === "10" || rank === "J" || rank === "Q" || rank === "K") return 0;
  if (rank === "A") return 1;
  return Number(rank);
}

function dealCard(shoe: Rank[]): number {
  const rank = shoe.pop();
  if (!rank) throw new Error("Shoe has run out of cards.");
  return cardValue(rank);
}

function playHand(shoe: Rank[]): Outcome {
  let pTotal = (dealCard(shoe) + dealCard(shoe)) % 10;
  let bTotal = (dealCard(shoe) + dealCard(shoe)) % 10;
  let playerThird: number | null = null;

  if (pTotal < 8 && bTotal < 8) {
    if (pTotal <= 5) {
      playerThird = dealCard(shoe);
      pTotal = (pTotal + playerThird) % 10;
    }

    if (playerThird === null) {
      if (bTotal <= 5) bTotal = (bTotal + dealCard(shoe)) % 10;
    } else {
      const bankerDraws =
        bTotal <= 2 ||
        (bTotal === 3 && playerThird !== 8) ||
        (bTotal === 4 && [2, 3, 4, 5, 6, 7].includes(playerThird)) ||
        (bTotal === 5 && [4, 5, 6, 7].includes(playerThird)) ||
        (bTotal === 6 && [6, 7].includes(playerThird));

      if (bankerDraws) bTotal = (bTotal + dealCard(shoe)) % 10;
    }
  }

  if (pTotal > bTotal) return "P";
  if (bTotal > pTotal) return "B";
  return "T";
}

function simulateShoe(handsTarget: number, rng: SeededRandom): {
  full: Outcome[];
  nontie: Exclude<Outcome, "T">[];
} {
  const shoe = newShoe(rng);

  const burn = dealCard(shoe);
  for (let i = 0; i < burn && shoe.length > 0; i += 1) shoe.pop();

  const full: Outcome[] = [];
  const nontie: Exclude<Outcome, "T">[] = [];

  while (shoe.length >= 6 && full.length < handsTarget) {
    const result = playHand(shoe);
    full.push(result);
    if (result !== "T") nontie.push(result);
  }

  return { full, nontie };
}

function streakLengths(seq: Exclude<Outcome, "T">[]): number[] {
  if (seq.length === 0) return [];

  const lengths: number[] = [];
  let current = 1;

  for (let i = 1; i < seq.length; i += 1) {
    if (seq[i] === seq[i - 1]) current += 1;
    else {
      lengths.push(current);
      current = 1;
    }
  }

  lengths.push(current);
  return lengths;
}

function histogram7Plus(lengths: number[]): Histogram {
  const hist: Histogram = {};

  for (const length of lengths) {
    const bucket = length >= 7 ? 7 : length;
    hist[bucket] = (hist[bucket] ?? 0) + 1;
  }

  return hist;
}

function classify(R: number): ShoeClass {
  if (R >= CLASS_D[0] && R < CLASS_D[1]) return "D";
  if (R >= CLASS_C[0] && R < CLASS_C[1]) return "C";
  if (R >= CLASS_BD[0] && R < CLASS_BD[1]) return "B/D";
  return null;
}

function meanSd(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0];

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return [mean, Math.sqrt(variance)];
}

function summaryFromShoes(shoes: ShoeResult[]): Summary {
  const summary = {} as Summary;
  summary.N_shoes = shoes.length;

  const metrics: Array<["S" | "R" | "T" | "N", keyof Summary]> = [
    ["S", "S_mean"],
    ["R", "R_mean"],
    ["T", "T_mean"],
    ["N", "N_mean"],
  ];

  for (const [metric, meanKey] of metrics) {
    const [mean, sd] = meanSd(shoes.map((shoe) => shoe[metric]));
    summary[meanKey] = mean;
    summary[`${metric}_sd`] = sd;
  }

  for (let k = 1; k <= 7; k += 1) {
    const [mean, sd] = meanSd(shoes.map((shoe) => shoe.hist[k] ?? 0));
    summary[`L${k}_mean`] = mean;
    summary[`L${k}_sd`] = sd;
  }

  return summary;
}

export class Analyzer {
  shoes: ShoeResult[] = [];

  run(nShoes: number, handsMin = CUT_CARD_MIN, handsMax = CUT_CARD_MAX): void {
    const rng = new SeededRandom(12345);
    this.shoes = [];

    for (let i = 0; i < nShoes; i += 1) {
      const target = rng.integer(handsMin, handsMax);
      const { full, nontie } = simulateShoe(target, rng);
      const lens = streakLengths(nontie);
      const S = lens.length;
      const R = S / Math.max(1, nontie.length);
      const hist = histogram7Plus(lens);

      this.shoes.push({
        full,
        nontie,
        lens,
        S,
        R,
        cls: classify(R),
        hist,
        T: full.filter((outcome) => outcome === "T").length,
        N: full.length,
      });
    }
  }

  aggregateSummary(): Summary {
    return summaryFromShoes(this.shoes);
  }

  classSummary(cls: Exclude<ShoeClass, null>): ClassSummary | null {
    const rows = this.shoes.filter((shoe) => shoe.cls === cls);
    if (rows.length === 0) return null;

    return {
      ...summaryFromShoes(rows),
      count: rows.length,
    };
  }

  classCounts(): Record<Exclude<ShoeClass, null>, number> {
    return {
      C: this.shoes.filter((shoe) => shoe.cls === "C").length,
      D: this.shoes.filter((shoe) => shoe.cls === "D").length,
      "B/D": this.shoes.filter((shoe) => shoe.cls === "B/D").length,
    };
  }

  verifyReferenceTable(): VerificationResult[] {
    return REFERENCE_TABLE.map(([name, S, _R, L1, L2, L3, L4, L5plus, _max, className]) => {
      const summary = this.classSummary(className);

      if (!summary) {
        return {
          name,
          className,
          S: "NO DATA",
          L1: "-",
          L2: "-",
          L3: "-",
          L4: "-",
          L5plus: "-",
          zS: "-",
          zL1: "-",
          verdict: "N/A",
          notes: "No simulated shoes in this class.",
        };
      }

      const z = (value: number, metric: string) => {
        const mean = summary[`${metric}_mean`];
        const sd = summary[`${metric}_sd`];
        return sd === 0 ? 0 : (value - mean) / sd;
      };

      const zS = z(S, "S");
      const zL1 = z(L1, "L1");
      const zL2 = z(L2, "L2");
      const zL3 = z(L3, "L3");
      const zL4 = z(L4, "L4");
      const zL5 = z(L5plus, "L5");

      const checks = {
        S: Math.abs(zS) <= 2,
        L1: Math.abs(zL1) <= 2,
        L2: Math.abs(zL2) <= 2,
        L3: Math.abs(zL3) <= 2,
        L4: Math.abs(zL4) <= 2,
        "L5+": Math.abs(zL5) <= 2,
      };

      const okCount = Object.values(checks).filter(Boolean).length;
      const verdict: VerificationResult["verdict"] =
        okCount === 6 ? "PASS" : okCount >= 4 ? "MOSTLY OK" : "FAIL";

      const scores: Record<string, number> = {
        S: zS,
        L1: zL1,
        L2: zL2,
        L3: zL3,
        L4: zL4,
        "L5+": zL5,
      };

      const notes = Object.entries(checks)
        .filter(([, pass]) => !pass)
        .map(([key]) => `${key} off by ${Math.abs(scores[key]).toFixed(1)}σ`)
        .join("; ") || "All within 2σ";

      return {
        name,
        className,
        S: checks.S ? "OK" : "OFF",
        L1: checks.L1 ? "OK" : "OFF",
        L2: checks.L2 ? "OK" : "OFF",
        L3: checks.L3 ? "OK" : "OFF",
        L4: checks.L4 ? "OK" : "OFF",
        L5plus: checks["L5+"] ? "OK" : "OFF",
        zS: `${zS >= 0 ? "+" : ""}${zS.toFixed(2)}σ`,
        zL1: `${zL1 >= 0 ? "+" : ""}${zL1.toFixed(2)}σ`,
        verdict,
        notes,
      };
    });
  }
}

export function buildExport(analyzer: Analyzer): string {
  const aggregate = analyzer.aggregateSummary();
  const lines: string[] = ["SIMULATION AGGREGATE"];

  Object.entries(aggregate).forEach(([key, value]) => {
    lines.push(`  ${key} = ${Number.isInteger(value) ? value : value.toFixed(4)}`);
  });

  lines.push("", "CLASS SUMMARY");

  (["C", "D", "B/D"] as const).forEach((cls) => {
    const summary = analyzer.classSummary(cls);
    if (!summary) return;

    lines.push("", `Class ${cls}: count=${summary.count}`);
    lines.push(`  S = ${summary.S_mean.toFixed(2)} ± ${summary.S_sd.toFixed(2)}`);
    lines.push(`  R = ${summary.R_mean.toFixed(4)} ± ${summary.R_sd.toFixed(4)}`);
    lines.push(`  T = ${summary.T_mean.toFixed(2)} ± ${summary.T_sd.toFixed(2)}`);

    for (let k = 1; k <= 7; k += 1) {
      lines.push(
        `  L${k}${k === 7 ? "+" : ""} = ${summary[`L${k}_mean`].toFixed(2)} ± ${summary[`L${k}_sd`].toFixed(2)}`,
      );
    }
  });

  lines.push("", "TABLE VERIFICATION");
  analyzer.verifyReferenceTable().forEach((result) => {
    lines.push(`  ${result.name.padEnd(22)} -> ${result.verdict.padEnd(10)} ${result.notes}`);
  });

  lines.push("", "PER-SHOE (first 500)");
  lines.push("idx N T S R L1 L2 L3 L4 L5 L6 L7+ class");

  analyzer.shoes.slice(0, 500).forEach((shoe, index) => {
    lines.push(
      [
        index + 1,
        shoe.N,
        shoe.T,
        shoe.S,
        shoe.R.toFixed(3),
        shoe.hist[1] ?? 0,
        shoe.hist[2] ?? 0,
        shoe.hist[3] ?? 0,
        shoe.hist[4] ?? 0,
        shoe.hist[5] ?? 0,
        shoe.hist[6] ?? 0,
        shoe.hist[7] ?? 0,
        shoe.cls ?? "-",
      ].join(" "),
    );
  });

  return lines.join("\n");
}

