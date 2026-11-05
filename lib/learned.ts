import codebook from "@/data/msxy-fp.json";
import type { Fan, Mode } from "@/lib/protocol";

type TempTable = Record<string, string>;

type Commands = {
  off: string;
  cool: Record<Fan, TempTable>;
  dry: Record<Fan, TempTable>;
  fan_only: Record<Fan, TempTable>;
};

const commands = codebook.commands as Commands;

export type LearnedCapture = {
  base64: string;
  issue?: string;
};

export function learnedCapture(input: {
  power: boolean;
  mode: Mode;
  fan: Fan;
  temperature: number;
}): LearnedCapture {
  if (!input.power) {
    return {
      base64: commands.off,
      issue:
        "The table stores one off code. It was learned as cool, 22°C, low fan, with the remote clock at 08:00. A generated off frame uses the settings currently on the remote.",
    };
  }
  const code = commands[input.mode][input.fan][String(input.temperature)];
  if (
    input.mode === "cool" &&
    input.fan === "high" &&
    input.temperature === 18
  ) {
    return {
      base64: code,
      issue:
        "The published capture for cool, high fan, 18°C is a copy of the 17°C code. The frame generated here writes temperature 18°C (byte 7 = 0x02).",
    };
  }
  return { base64: code };
}
