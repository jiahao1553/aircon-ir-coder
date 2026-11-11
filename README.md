# Aircon IR coder

A static web app and TypeScript library that generates air-conditioner IR codes from the protocol rather than from learned buttons. Pick the aircon's protocol, set the remote's mode, fan, vane and temperature, then copy the code to a Flipper Zero or your blaster, or download a [SmartIR](https://github.com/litinoveweedle/SmartIR) climate file for a SmartIR controller.

## Run

```bash
npm install
npm run dev      # http://localhost:3847
npm test         # every protocol, transport and the SmartIR builder
npm run lint
npm run build    # static export to out/
```

## Using the app

1. **Protocol.** Choose the protocol from the dropdown, or turn the knob and use the arrows. Each protocol lists only the modes, fans, vane positions and extras its remote really has. Unsupported controls are disabled.
2. **Remote.** Set power, mode, fan, temperature, and vane or wide-vane positions the same way the physical remote does. The wall unit and the LCD update as you change them.
3. **Controller.** Pick the SmartIR controller, or the Broadlink, Tuya, ESPHome or Pronto encoding it reads. The code is shown with a Copy button, and a Flipper `.ir` file can be downloaded.
4. **SmartIR file.** Enter the manufacturer and model, select the modes, fans and vane positions you want in the file, then print the SmartIR file. Save it as `custom_codes/climate/<number>.json` and set `device_code` to that number.

Vane positions are chosen on the fan graphic: click a stroke to turn it on or off. If nothing is selected, swing is left out of the file. Auto and Swing sit beside the fan. The wide-vane fan hangs from the top, with the left and right labels as you face the unit.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` tests, builds and publishes `out/` on every push to `main`. In the repo settings, set **Pages → Source** to **GitHub Actions**. The workflow sets `PAGES_BASE_PATH=/<repo>` so asset URLs work under `https://<user>.github.io/<repo>/`; for a `<user>.github.io` repo it leaves the base path empty.

## Library layout

```
lib/ir/
  core/        types (ClimateState, AcProtocol), pulse-distance writer/reader, bit and checksum helpers
  protocols/   one file per protocol, each with its own test file (67 protocols)
  transports/  Broadlink, Tuya (UFO-R11 / ZS06 / Zigbee2MQTT), Pronto, ESPHome, Flipper .ir
  formats.ts   SmartIR controllers, the encoding each one reads, and the codec for each encoding
  brands.ts    brand → model → candidate protocols (data generated into brands.data.ts)
  smartir.ts   SmartIR climate JSON builder and the Flipper test set
  index.ts     registry, identify(), encodeState(), fitState()
components/guide/   the single-page UI: protocol, remote, wall unit, controller, SmartIR builder
```

Every protocol implements the same small interface:

- `build(state, variant?)`: a brand-neutral state in, payload bytes out (checksums included).
- `parse(bytes)`: bytes back to the state.
- `modulate(bytes)` / `demodulate(pulses)`: payload to µs mark/space timings and back, validating timing and checksum.
- `capabilities`: the modes, fans, vane positions, temperature range and extras the remote really has.
- `variants`: documented remote-to-remote differences inside one protocol, offered as "didn't work, next" trials.
- `powerToggle`: set on remotes whose power key only toggles. The SmartIR file then writes the same toggle frame for both `on` and `off`.

Each protocol is checked against byte vectors and captures from upstream test suites. Those captures are copied from third-party repositories, so `data/fixtures/` is gitignored and not redistributed. Tests that read it run only when the folder is present locally and are skipped in CI. `data/888.json` (a learned Mr. Slim) and `data/msxy-fp.json` (SmartIR 1136) are the Mitsubishi golden captures.

## Licence

The code in this repository is MIT licensed (see `LICENSE`). Third-party sources are listed below and keep their own licences.

## SmartIR controllers

| Controller | Encoding | Stored in the climate file | Sent by SmartIR |
| --- | --- | --- | --- |
| Broadlink | Base64 | Broadlink packet (`0x26`, 8192/269 µs ticks), base64 | `b64:` plus that packet |
| Broadlink | Hex | The same packet, hex | Hex is decoded, then sent as `b64:` |
| Broadlink | Pronto | Pronto hex words | Converted to a Broadlink packet, then sent as `b64:` |
| Xiaomi | Pronto | Pronto hex words | `pronto:` plus that string |
| LOOKin | Pronto | Pronto hex words | `GET /commands/ir/prontohex/<code>` |
| MQTT | Raw | Tuya compressed stream | That string, as the MQTT payload |
| UFO-R11 | Raw | `{"ir_code_to_send": "<tuya>"}`, with `supportedController` set to MQTT | That JSON, as the MQTT payload |
| ZHA | Raw | Tuya compressed stream | Zigbee command parameter `code` |
| ESPHome | Raw | JSON array, marks positive, spaces negative | Parsed and passed to the ESPHome service |

Xiaomi and LOOKin also accept a Raw encoding. Those Raw bodies are device-specific (a Chuangmi blob, a LOOKin path), so the file uses Pronto, which both controllers accept and which is built from the pulse list.

## Brand list

The brand and model picker is no longer shown in the app, but the data is still generated and checked by the test suite. `lib/ir/brands.data.ts` comes from IRremoteESP8266's `SupportedProtocols.md`, keeping only rows with full A/C support:

```bash
npx tsx scripts/gen-brands.ts path/to/IRremoteESP8266/SupportedProtocols.md
```

A model tagged with a sub-protocol (for example `(DAIKIN2)`) maps straight to it. A tag naming a remote (for example `(ARRAH2E)`) becomes a variant hint. Untagged models list every protocol from the same family as trials. Rerun the script after adding a protocol file.

## Sources and licences

- [IRremoteESP8266](https://github.com/crankyoldgit/IRremoteESP8266) and [IRremoteIDF](https://github.com/crankyoldgit/IRremoteIDF) (LGPL-2.1): frame layouts, timings, checksums, the brand and model list, and test vectors. The protocols here are written from those documented facts; no source is copied.
- [SmartIR, litinoveweedle fork](https://github.com/litinoveweedle/SmartIR) (MIT): the climate file schema, the controller list, and community captures used as fixtures.
- [svyatogor's Broadlink-to-Tuya gist](https://gist.github.com/svyatogor/7839d00303998a9fa37eb48494dd680f): the Tuya stream compression.
- [Flipper Zero infrared file format](https://github.com/flipperdevices/flipperzero-firmware/blob/dev/documentation/file_formats/InfraredFileFormats.md) and [Flipper-IRDB](https://github.com/Lucaslhm/Flipper-IRDB) (CC0): the `.ir` format and the universal `ac.ir` button names (`Off`, `Cool_hi`, `Cool_lo`, `Heat_hi`, `Heat_lo`, `Dh`).
