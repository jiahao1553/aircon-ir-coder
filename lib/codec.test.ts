import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { broadlinkToFrame, frameToBroadlink } from "./broadlink";
import { buildFrame, formatBytes, parseFrame, quantizeClock } from "./protocol";

const book = JSON.parse(readFileSync(new URL("../data/msxy-fp.json", import.meta.url), "utf8"));
const modes = ["cool", "dry", "fan_only"] as const;
const fans = ["quiet", "auto", "low", "mid", "high", "highest"] as const;

test("every learned on-command rebuilds, except the duplicated 18°C high-fan capture", () => {
  let matches = 0;
  for (const mode of modes) {
    for (const fan of fans) {
      for (let temperature = 16; temperature <= 31; temperature += 1) {
        const { frame } = broadlinkToFrame(book.commands[mode][fan][String(temperature)]);
        const parsed = parseFrame(frame);
        assert.equal(parsed.checksumOk, true);
        assert.equal(parsed.headerOk, true);
        assert.equal(parsed.power, true);
        assert.equal(parsed.mode, mode);
        assert.equal(parsed.fan, fan);
        if (mode === "cool" && !(fan === "high" && temperature === 18)) {
          assert.equal(parsed.temperature, temperature);
        }
        const built = buildFrame({
          power: true,
          mode,
          fan,
          temperature,
          clockMinutes: parsed.clockMinutes,
        });
        const same = built.every((byte, index) => byte === frame[index]);
        if (mode === "cool" && fan === "high" && temperature === 18) {
          assert.equal(same, false);
          assert.equal(frame[7], 0x01);
          assert.equal(built[7], 0x02);
        } else {
          assert.equal(same, true, `${mode} ${fan} ${temperature}: ${formatBytes(built)} vs ${formatBytes(frame)}`);
          matches += 1;
        }
      }
    }
  }
  assert.equal(matches, 287);
});

test("the off command is cool, 22°C, low fan, power clear", () => {
  const { frame } = broadlinkToFrame(book.commands.off);
  const parsed = parseFrame(frame);
  assert.equal(parsed.power, false);
  assert.equal(parsed.mode, "cool");
  assert.equal(parsed.temperature, 22);
  assert.equal(parsed.fan, "low");
  const built = buildFrame({
    power: false,
    mode: "cool",
    fan: "low",
    temperature: 22,
    clockMinutes: parsed.clockMinutes,
  });
  assert.deepEqual(built, frame);
});

test("generated Broadlink packets decode back to the same frame", () => {
  const frame = buildFrame({
    power: true,
    mode: "dry",
    fan: "quiet",
    temperature: 19,
    clockMinutes: 8 * 60 + 7,
  });
  assert.equal(frame[7], 0x08);
  assert.equal(frame[10], quantizeClock(8 * 60 + 7) / 6);
  const decoded = broadlinkToFrame(frameToBroadlink(frame)).frame;
  assert.deepEqual(decoded, frame);
});

test("cool limits and auto outside cool use the 0xB fan byte", () => {
  const atFloor = buildFrame({
    power: true,
    mode: "cool",
    fan: "mid",
    temperature: 16,
    clockMinutes: 0,
  });
  const atMid = buildFrame({
    power: true,
    mode: "cool",
    fan: "mid",
    temperature: 24,
    clockMinutes: 0,
  });
  const dryAuto = buildFrame({
    power: true,
    mode: "dry",
    fan: "auto",
    temperature: 24,
    clockMinutes: 0,
  });
  assert.equal(atFloor[9], 0xba);
  assert.equal(atMid[9], 0x7a);
  assert.equal(dryAuto[9], 0xb8);
  assert.equal(parseFrame(atFloor).fan, "mid");
  assert.equal(parseFrame(dryAuto).fan, "auto");
  assert.equal(parseFrame(dryAuto).temperature, null);
});
