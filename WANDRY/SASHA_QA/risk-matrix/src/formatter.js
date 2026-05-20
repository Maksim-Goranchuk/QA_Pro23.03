export function formatRiskMatrix(data) {
  const header =
    "Component | Risk | Cause | Probability | Impact | Priority | Test Cases\n";
 
  if (!data?.risks?.length) {
    return header + "No data generated";
  }
 
  const rows = data.risks.map((r) =>
    [
      r.component || "-",
      r.risk || "-",
      r.cause || "-",
      r.probability || "-",
      r.impact || "-",
      r.priority || "-",
      r.test_cases || "-",
    ].join(" | ")
  );
 
  return header + rows.join("\n");
}