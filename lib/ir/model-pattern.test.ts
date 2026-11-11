import assert from "node:assert/strict";
import test from "node:test";
import { modelCodes } from "./model-pattern";
import { PROTOCOL_MODELS } from "./protocol-models.data";

test("model codes drop prose, unknowns, and parenthetical notes", () => {
  assert.deepEqual(
    modelCodes([
      "Unknown",
      "MSZ-HR35VF (remote RH18A 903AL)",
      "RAS-13NKV-E / RAS-13NAV-E",
      "HSU-09HPL03/R03",
      "Gree Smart inverter models",
    ]),
    ["MSZ-HR35VF", "RAS-13NKV-E", "RAS-13NAV-E", "HSU-09HPL03/R03"],
  );
});

test("Hitachi 296-bit keeps the SmartIR model names", () => {
  const models = PROTOCOL_MODELS.hitachi_ac296;
  for (const model of ["RAC-10EH1", "RAC-18EH1", "RAS-10EH1", "RAS-10EH3", "RAS-18EH1"]) {
    assert.ok(models.includes(model), model);
  }
  assert.equal(models.some((m) => m.includes("|")), false);
});
