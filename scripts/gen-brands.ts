// Regenerates lib/ir/brands.data.ts from IRremoteESP8266's SupportedProtocols.md.
//
// Usage: npx tsx scripts/gen-brands.ts path/to/SupportedProtocols.md
//
// Only rows with detailed A/C support are kept. A model tagged "(DAIKIN2)" maps to that protocol;
// a tag naming a remote model ("(ARRAH2E)", "(A903)") becomes a variant hint; untagged models list
// every protocol implemented from the same source file as candidates to try.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IMPLEMENTED = new Set(
  readdirSync(join(ROOT, "lib/ir/protocols"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => name.slice(0, -".ts".length))
    .filter((stem) => !stem.startsWith("_") && stem !== "index" && !stem.endsWith(".test")),
);

const FAMILY: Record<string, string[]> = {
  Airton: ["airton"], Airwell: ["airwell"], Amcor: ["amcor"], Argo: ["argo"], Bosch: ["bosch144"],
  Carrier: ["carrier_ac64"], Coolix: ["coolix"], Corona: ["corona_ac"],
  Daikin: ["daikin", "daikin2", "daikin64", "daikin128", "daikin152", "daikin160", "daikin176", "daikin216", "daikin312"],
  Delonghi: ["delonghi_ac"], Ecoclim: ["ecoclim"], Electra: ["electra_ac"], Eurom: ["eurom"],
  Fujitsu: ["fujitsu_ac"], Goodweather: ["goodweather"], Gree: ["gree"],
  Haier: ["haier_ac", "haier_ac_yrw02", "haier_ac160", "haier_ac176"],
  Hitachi: ["hitachi_ac", "hitachi_ac1", "hitachi_ac264", "hitachi_ac296", "hitachi_ac344", "hitachi_ac424"],
  Kelon: ["kelon"], Kelvinator: ["kelvinator"], LG: ["lg", "lg2"], Midea: ["midea"], Mirage: ["mirage"],
  Mitsubishi: ["mitsubishi_ac", "mitsubishi112", "mitsubishi136"],
  MitsubishiHeavy: ["mitsubishi_heavy_88", "mitsubishi_heavy_152"], Neoclima: ["neoclima"],
  Panasonic: ["panasonic_ac", "panasonic_ac32"], Rhoss: ["rhoss"], Samsung: ["samsung_ac"],
  Sanyo: ["sanyo_ac", "sanyo_ac88"], Sharp: ["sharp_ac"], Tcl: ["tcl112ac"], Technibel: ["technibel_ac"],
  Teco: ["teco"], Teknopoint: ["teknopoint"], Toshiba: ["toshiba_ac"], Transcold: ["transcold"],
  Trotec: ["trotec", "trotec_3550"], Truma: ["truma"], Vestel: ["vestel_ac"], Voltas: ["voltas"],
  Whirlpool: ["whirlpool_ac"], York: ["york"],
};

const NOT_AC = /\b(TV|Projector|Soundbar|Bluray|Stand Fan|transmitter IC|disabled)\b/i;

interface ModelEntry {
  model: string;
  protocols: string[];
  variant?: string;
}

function linkText(cell: string): string {
  return cell.replace(/\*|\[([^\]]*)\]\([^)]*\)/g, (_match, text?: string) => text ?? "").trim();
}

function stripChars(value: string, chars: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && chars.includes(value[start])) start++;
  while (end > start && chars.includes(value[end - 1])) end--;
  return value.slice(start, end);
}

/** Candidate protocol ids, plus a variant hint. An empty list is a sub-protocol this repo does not cover. */
function resolve(source: string, model: string): { protocols: string[]; variant?: string } {
  const family = FAMILY[source];
  const tag = /\(([^()]*)\)\s*$/.exec(model) ?? /\[(\w+) remote\]/.exec(model);
  if (!tag) return { protocols: family };
  const text = tag[1].trim();
  if (text === "88 bit" || text === "152 bit") return { protocols: [`mitsubishi_heavy_${text.split(/\s+/)[0]}`] };
  const splitAt = text.indexOf(" ");
  const head = splitAt === -1 ? text : text.slice(0, splitAt);
  const rest = splitAt === -1 ? "" : text.slice(splitAt + 1);
  if (family.includes(head.toLowerCase())) {
    const variant = stripChars(rest, " -").split("/")[0].split(" & ")[0];
    return variant ? { protocols: [head.toLowerCase()], variant } : { protocols: [head.toLowerCase()] };
  }
  if (/^[A-Z][A-Z0-9_]+$/.test(head) && head.toLowerCase().startsWith(source.toLowerCase().slice(0, 4))) return { protocols: [] };
  return { protocols: family, variant: text };
}

function main(md: string) {
  const brands = new Map<string, ModelEntry[]>();
  for (const line of readFileSync(md, "utf8").split(/\r\n|\n|\r/)) {
    if (!line.startsWith("| [")) continue;
    const cells = line.trim().replace(/^\|+|\|+$/g, "").split("|").map((cell) => cell.trim());
    if (cells.length !== 5) throw new Error(`expected 5 columns: ${line}`);
    const [proto, brand, models, , detailed] = cells;
    if (detailed !== "Yes") continue;
    const source = linkText(proto);
    if (!(source in FAMILY)) continue;
    for (const raw of models.split("<BR>")) {
      const model = raw.trim();
      if (!model || NOT_AC.test(model)) continue;
      const resolved = resolve(source, model);
      const protocols = resolved.protocols.filter((id) => IMPLEMENTED.has(id));
      if (!protocols.length) continue;
      const entry: ModelEntry = { model: model.replace(/\s*\([^()]*\)\s*$/, "").trim(), protocols };
      if (resolved.variant) entry.variant = resolved.variant;
      const name = linkText(brand);
      brands.set(name, [...(brands.get(name) ?? []), entry]);
    }
  }

  const body = JSON.stringify(
    Object.fromEntries([...brands.entries()].sort(([a], [b]) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))),
    null,
    2,
  );
  const out = join(ROOT, "lib/ir/brands.data.ts");
  writeFileSync(
    out,
    "// Generated by scripts/gen-brands.ts from IRremoteESP8266 SupportedProtocols.md (LGPL-2.1 project; facts only).\n" +
      "// https://github.com/crankyoldgit/IRremoteESP8266/blob/master/SupportedProtocols.md\n" +
      `export const BRAND_MODELS: Record<string, { model: string; protocols: string[]; variant?: string }[]> = ${body};\n`,
  );
  const models = [...brands.values()].reduce((count, entries) => count + entries.length, 0);
  console.log(`${brands.size} brands, ${models} models -> ${relative(ROOT, out)}`);
}

const md = process.argv[2];
if (!md) {
  console.error("Usage: npx tsx scripts/gen-brands.ts path/to/SupportedProtocols.md");
  process.exit(1);
}
main(md);
