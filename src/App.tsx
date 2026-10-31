import { useMemo, useState } from "react";
import {
  Analyzer,
  buildExport,
  CUT_CARD_MAX,
  CUT_CARD_MIN,
  type ClassSummary,
  type Summary,
} from "./baccarat";
import "./styles.css";

type Tab = "verify" | "class" | "aggregate" | "history" | "log";

const formatMeanSd = (summary: ClassSummary | null, metric: string, digits = 2) => {
  if (!summary) return "-";
  return `${summary[`${metric}_mean`].toFixed(digits)} ± ${summary[`${metric}_sd`].toFixed(digits)}`;
};

function downloadTextFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const CLASS_METRIC_ROWS: Array<
  [label: string, metric: string, digits: number]
> = [
  ["S mean ± SD", "S", 2],
  ["R mean ± SD", "R", 4],
  ["T mean ± SD", "T", 2],
  ["N mean ± SD", "N", 2],
  ...Array.from(
    { length: 7 },
    (_, i): [string, string, number] => [
      `L${i + 1}${i === 6 ? "+" : ""} mean ± SD`,
      `L${i + 1}`,
      2,
    ],
  ),
];

export default function App() {
  const [shoesInput, setShoesInput] = useState("2000");
  const [minInput, setMinInput] = useState(String(CUT_CARD_MIN));
  const [maxInput, setMaxInput] = useState(String(CUT_CARD_MAX));
  const [analyzer, setAnalyzer] = useState<Analyzer | null>(null);
  const [status, setStatus] = useState("Ready.");
  const [tab, setTab] = useState<Tab>("verify");
  const [logs, setLogs] = useState<string[]>([]);

  const aggregate = useMemo<Summary | null>(
    () => (analyzer ? analyzer.aggregateSummary() : null),
    [analyzer],
  );

  const classSummaries = useMemo(
    () => ({
      C: analyzer?.classSummary("C") ?? null,
      D: analyzer?.classSummary("D") ?? null,
      "B/D": analyzer?.classSummary("B/D") ?? null,
    }),
    [analyzer],
  );

  const verification = useMemo(
    () => analyzer?.verifyReferenceTable() ?? [],
    [analyzer],
  );

  const runSimulation = () => {
    const shoes = Number.parseInt(shoesInput, 10);
    const handsMin = Number.parseInt(minInput, 10);
    const handsMax = Number.parseInt(maxInput, 10);

    if (!Number.isInteger(shoes) || shoes < 1) {
      setStatus("Invalid input: shoes must be at least 1.");
      return;
    }

    if (!Number.isInteger(handsMin) || !Number.isInteger(handsMax) || handsMin < 1 || handsMax <= handsMin) {
      setStatus("Invalid input: hands max must be greater than hands min.");
      return;
    }

    setStatus(`Simulating ${shoes.toLocaleString()} shoes...`);

    window.setTimeout(() => {
      const next = new Analyzer();
      next.run(shoes, handsMin, handsMax);
      setAnalyzer(next);
      setLogs((current) => [...current, `Simulated ${shoes.toLocaleString()} shoes, hands ${handsMin}–${handsMax}.`]);
      setStatus("Done.");
    }, 30);
  };

  const exportSummary = () => {
    if (!analyzer) {
      setStatus("Run a simulation before exporting.");
      return;
    }

    downloadTextFile(buildExport(analyzer), "ez-baccarat-summary.txt");
    setLogs((current) => [...current, "Exported summary to ez-baccarat-summary.txt"]);
    setStatus("Export complete.");
  };

  return (
    <main className="app-shell">
      <header>
        <div>
          <h1>EZ Baccarat — Streak Verification</h1>
          <p>L1 through L7+ streak histograms, class summaries, and reference-table checks.</p>
        </div>
        <span className="author">Developed by Long Nguyen</span>
      </header>

      <section className="controls" aria-label="Simulation controls">
        <label>
          Shoes
          <input value={shoesInput} onChange={(event) => setShoesInput(event.target.value)} inputMode="numeric" />
        </label>

        <label>
          Hands min
          <input value={minInput} onChange={(event) => setMinInput(event.target.value)} inputMode="numeric" />
        </label>

        <label>
          Hands max
          <input value={maxInput} onChange={(event) => setMaxInput(event.target.value)} inputMode="numeric" />
        </label>

        <button className="primary" onClick={runSimulation}>Run Simulation</button>
        <button onClick={exportSummary} disabled={!analyzer}>Export Summary</button>
        <span className="status" role="status">{status}</span>
      </section>

      <nav className="tabs" aria-label="Results sections">
        <button className={tab === "verify" ? "active" : ""} onClick={() => setTab("verify")}>Table Verification</button>
        <button className={tab === "class" ? "active" : ""} onClick={() => setTab("class")}>Class Summary</button>
        <button className={tab === "aggregate" ? "active" : ""} onClick={() => setTab("aggregate")}>Simulation Aggregate</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Per-Shoe History</button>
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>Log</button>
      </nav>

      <section className="panel">
        {!analyzer ? (
          <div className="empty-state">Enter the parameters and choose <strong>Run Simulation</strong>.</div>
        ) : (
          <>
            {tab === "verify" && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Example</th><th>Class</th><th>S</th><th>L1</th><th>L2</th><th>L3</th>
                        <th>L4</th><th>L5+</th><th>z(S)</th><th>z(L1)</th><th>Verdict</th><th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verification.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.className}</td>
                          <td>{row.S}</td>
                          <td>{row.L1}</td>
                          <td>{row.L2}</td>
                          <td>{row.L3}</td>
                          <td>{row.L4}</td>
                          <td>{row.L5plus}</td>
                          <td>{row.zS}</td>
                          <td>{row.zL1}</td>
                          <td><span className={`badge ${row.verdict.toLowerCase().replace(" ", "-")}`}>{row.verdict}</span></td>
                          <td className="notes">{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint">PASS means every field is within ±2σ of the simulated class distribution. MOSTLY OK means 4–5 of 6 fields pass.</p>
              </>
            )}

            {tab === "class" && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Metric</th><th>C</th><th>D</th><th>B/D</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Shoe count</td>
                      <td>{classSummaries.C?.count ?? 0}</td>
                      <td>{classSummaries.D?.count ?? 0}</td>
                      <td>{classSummaries["B/D"]?.count ?? 0}</td>
                    </tr>
                    {CLASS_METRIC_ROWS.map(([label, metric, digits]) => (
                      <tr key={metric}>
                        <td>{label}</td>
                        <td>
                          {formatMeanSd(classSummaries.C, metric, digits)}
                        </td>
                        <td>
                          {formatMeanSd(classSummaries.D, metric, digits)}
                        </td>
                        <td>
                          {formatMeanSd(classSummaries["B/D"], metric, digits)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "aggregate" && aggregate && (
              <AggregateView analyzer={analyzer} aggregate={aggregate} />
            )}

            {tab === "history" && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>N</th><th>T</th><th>S</th><th>R</th><th>L1</th><th>L2</th>
                        <th>L3</th><th>L4</th><th>L5</th><th>L6</th><th>L7+</th><th>Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyzer.shoes.slice(0, 1000).map((shoe, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{shoe.N}</td>
                          <td>{shoe.T}</td>
                          <td>{shoe.S}</td>
                          <td>{shoe.R.toFixed(3)}</td>
                          {[1, 2, 3, 4, 5, 6, 7].map((k) => <td key={k}>{shoe.hist[k] ?? 0}</td>)}
                          <td>{shoe.cls ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint">First 1,000 shoes shown. Export includes the first 500, matching the original program.</p>
              </>
            )}

            {tab === "log" && (
              <pre className="log">{logs.length ? logs.join("\n") : "No simulation activity yet."}</pre>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function AggregateView({ analyzer, aggregate }: { analyzer: Analyzer; aggregate: Summary }) {
  const classCounts = analyzer.classCounts();
  const inBand = classCounts.C + classCounts.D + classCounts["B/D"] || 1;

  return (
    <div className="aggregate">
      <h2>Simulation Aggregate</h2>

      <dl className="metrics">
        <div><dt>Shoes simulated</dt><dd>{aggregate.N_shoes.toLocaleString()}</dd></div>
        <div><dt>Streaks S / shoe</dt><dd>{aggregate.S_mean.toFixed(2)} ± {aggregate.S_sd.toFixed(2)}</dd></div>
        <div><dt>R = S/N per shoe</dt><dd>{aggregate.R_mean.toFixed(4)} ± {aggregate.R_sd.toFixed(4)}</dd></div>
        <div><dt>Ties T / shoe</dt><dd>{aggregate.T_mean.toFixed(2)} ± {aggregate.T_sd.toFixed(2)}</dd></div>
        <div><dt>Total hands N / shoe</dt><dd>{aggregate.N_mean.toFixed(2)} ± {aggregate.N_sd.toFixed(2)}</dd></div>
        <div><dt>Tie rate T/N</dt><dd>{(aggregate.T_mean / Math.max(1, aggregate.N_mean)).toFixed(4)}</dd></div>
      </dl>

      <h3>Streak lengths per shoe</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Bucket</th><th>Mean ± SD</th><th>1σ range</th></tr></thead>
          <tbody>
            {Array.from({ length: 7 }, (_, index) => {
              const k = index + 1;
              const mean = aggregate[`L${k}_mean`];
              const sd = aggregate[`L${k}_sd`];
              return (
                <tr key={k}>
                  <td>L{k}{k === 7 ? "+" : ""}</td>
                  <td>{mean.toFixed(2)} ± {sd.toFixed(2)}</td>
                  <td>{Math.max(0, Math.round(mean - sd))}–{Math.round(mean + sd)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Class distribution</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Class</th><th>Shoes</th><th>In-band share</th></tr></thead>
          <tbody>
            {(["C", "D", "B/D"] as const).map((cls) => (
              <tr key={cls}>
                <td>{cls}</td>
                <td>{classCounts[cls].toLocaleString()}</td>
                <td>{(100 * classCounts[cls] / inBand).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

