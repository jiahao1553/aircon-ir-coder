import { decodeBroadlink, decodeBroadlinkHex, encodeBroadlink, encodeBroadlinkHex } from "./transports/broadlink";
import { decodeEsphome, encodeEsphome } from "./transports/esphome";
import { decodePronto, encodePronto } from "./transports/pronto";
import { decodeTuya, encodeTuya } from "./transports/tuya";

export type Encoding = "Base64" | "Hex" | "Pronto" | "Raw";

export interface Codec {
  id: string;
  label: string;
  encode(pulses: number[], frequency: number): string;
  decode(text: string): number[];
}

export const CODECS = {
  broadlink: { id: "broadlink", label: "Broadlink Base64", encode: encodeBroadlink, decode: decodeBroadlink },
  broadlinkHex: { id: "broadlinkHex", label: "Broadlink hex", encode: encodeBroadlinkHex, decode: decodeBroadlinkHex },
  pronto: { id: "pronto", label: "Pronto", encode: encodePronto, decode: (t: string) => decodePronto(t).pulses },
  tuya: { id: "tuya", label: "Tuya (UFO-R11 / ZS06)", encode: encodeTuya, decode: decodeTuya },
  esphome: { id: "esphome", label: "ESPHome raw", encode: encodeEsphome, decode: decodeEsphome },
} satisfies Record<string, Codec>;

export type CodecId = keyof typeof CODECS;

/** SmartIR controllers and the (encoding, codec) pairs each accepts, per SmartIR's controller_const.py. */
export const CONTROLLERS: { id: string; label: string; options: { encoding: Encoding; codec: CodecId }[] }[] = [
  {
    id: "Broadlink",
    label: "Broadlink",
    options: [
      { encoding: "Base64", codec: "broadlink" },
      { encoding: "Hex", codec: "broadlinkHex" },
      { encoding: "Pronto", codec: "pronto" },
    ],
  },
  { id: "UFOR11", label: "UFO-R11 (MQTT)", options: [{ encoding: "Raw", codec: "tuya" }] },
  { id: "MQTT", label: "MQTT (Zigbee2MQTT Tuya IR)", options: [{ encoding: "Raw", codec: "tuya" }] },
  { id: "ZHA", label: "ZHA (Tuya ZS06)", options: [{ encoding: "Raw", codec: "tuya" }] },
  { id: "ESPHome", label: "ESPHome", options: [{ encoding: "Raw", codec: "esphome" }] },
  { id: "Xiaomi", label: "Xiaomi", options: [{ encoding: "Pronto", codec: "pronto" }] },
  { id: "LOOKin", label: "LOOKin", options: [{ encoding: "Pronto", codec: "pronto" }] },
];

/** Guesses the format of a pasted code. */
export function decodeAny(text: string): { codec: CodecId; pulses: number[] } {
  const t = text.trim();
  const attempts: CodecId[] = t.startsWith("[")
    ? ["esphome"]
    : /^0000(\s+[0-9a-f]{4})+$/i.test(t)
      ? ["pronto"]
      : /^26[0-9a-f]+$/i.test(t)
        ? ["broadlinkHex"]
        : ["broadlink", "tuya"];
  for (const codec of attempts) {
    try {
      const pulses = CODECS[codec].decode(t);
      if (pulses.length > 8) return { codec, pulses };
    } catch {
      // try the next format
    }
  }
  throw new Error("Could not read that code as Broadlink, Tuya, Pronto or ESPHome.");
}
