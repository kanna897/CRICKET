import test from "node:test";
import assert from "node:assert/strict";
import { rowsToCsv } from "../lib/csv.ts";

test("CSV export safely quotes commas, quotes and spreadsheet-like values", () => {
  const csv = rowsToCsv(
    ["Name", "Venue", "Status"],
    [['Club "A"', "Jaffna, North", "=READY"]],
  );
  assert.equal(
    csv,
    '"Name","Venue","Status"\r\n"Club ""A""","Jaffna, North","\'=READY"',
  );
});
