# MSXY-FP IR studio

Decode and build Broadlink infrared codes for the Mitsubishi Electric MSXY-FP10VG, MSXY-FP13VG, and MSXY-FP18VG.

The supplied SmartIR table is a set of learned Broadlink packets. Each packet carries the same 18-byte Mitsubishi frame twice. This app reads that frame and can generate one for cool, dry, and fan-only, from 16°C to 31°C, at quiet, auto, low, mid, high, or highest fan.

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 3847. `npm test` checks the generator against every code in `data/msxy-fp.json`.

## Frame

Bytes are sent least significant bit first.

| Bytes | Meaning |
| --- | --- |
| 0–4 | Preamble `23 CB 26 01 00` |
| 5 | Power: `20` on, `00` off |
| 6 | Mode: cool `18`, dry `10`, fan `38` |
| 7 | Cool setpoint minus 16. Dry and fan store `08` |
| 8 | Vane byte, constant per mode: cool `36`, dry `32`, fan `30` |
| 9 | Fan in the low 3 bits: 0 auto, 1 low, 2 mid, 3 high, 4 highest, 5 quiet. Upper nibble is `7`, or `B` at 16°C and 31°C in cool, and for auto fan in dry and fan-only |
| 10 | Remote clock, minutes divided by 6 |
| 11–16 | Zero |
| 17 | Checksum, low 8 bits of the sum of bytes 0–16 |

The IR timing is a 3.5 ms header mark, a 1.7 ms header space, a 0.43 ms bit mark, a 0.39 ms space for 0, and a 1.25 ms space for 1. Broadlink stores those widths as ticks of 8192/269 microseconds, in a packet that starts with `0x26`.

287 of the 288 on-commands rebuild exactly, clock included. The published capture for cool, high fan, 18°C is a copy of the 17°C code, so the generator writes 18°C (`byte 7 = 02`) rather than repeating that capture. The single off code in the table is cool, 22°C, low fan, with the power byte clear.

There is no heat mode and no operating-mode auto in this code set. Copy the Base64 string into a Broadlink sender. The studio does not transmit IR by itself.
