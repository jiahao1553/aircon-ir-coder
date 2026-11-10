import type { AcProtocol } from "../core/types";
import { airton } from "./airton";
import { airwell } from "./airwell";
import { amcor } from "./amcor";
import { argo } from "./argo";
import { bosch144 } from "./bosch144";
import { carrierAc64 } from "./carrier_ac64";
import { coolix } from "./coolix";
import { coronaAc } from "./corona_ac";
import { daikin } from "./daikin";
import { daikin128 } from "./daikin128";
import { daikin152 } from "./daikin152";
import { daikin160 } from "./daikin160";
import { daikin176 } from "./daikin176";
import { daikin2 } from "./daikin2";
import { daikin216 } from "./daikin216";
import { daikin312 } from "./daikin312";
import { daikin64 } from "./daikin64";
import { delonghiAc } from "./delonghi_ac";
import { ecoclim } from "./ecoclim";
import { electraAc } from "./electra_ac";
import { eurom } from "./eurom";
import { fujitsuAc } from "./fujitsu_ac";
import { goodweather } from "./goodweather";
import { gree } from "./gree";
import { haierAc } from "./haier_ac";
import { haierAc160 } from "./haier_ac160";
import { haierAc176 } from "./haier_ac176";
import { haierAcYrw02 } from "./haier_ac_yrw02";
import { hitachiAc } from "./hitachi_ac";
import { hitachiAc1 } from "./hitachi_ac1";
import { hitachiAc264 } from "./hitachi_ac264";
import { hitachiAc296 } from "./hitachi_ac296";
import { hitachiAc344 } from "./hitachi_ac344";
import { hitachiAc424 } from "./hitachi_ac424";
import { kelon } from "./kelon";
import { kelon168 } from "./kelon168";
import { kelvinator } from "./kelvinator";
import { lg } from "./lg";
import { lg2 } from "./lg2";
import { midea } from "./midea";
import { mirage } from "./mirage";
import { mitsubishi112 } from "./mitsubishi112";
import { mitsubishi136 } from "./mitsubishi136";
import { mitsubishiAc } from "./mitsubishi_ac";
import { mitsubishiHeavy152 } from "./mitsubishi_heavy_152";
import { mitsubishiHeavy88 } from "./mitsubishi_heavy_88";
import { neoclima } from "./neoclima";
import { panasonicAc } from "./panasonic_ac";
import { panasonicAc32 } from "./panasonic_ac32";
import { rhoss } from "./rhoss";
import { samsungAc } from "./samsung_ac";
import { sanyoAc } from "./sanyo_ac";
import { sanyoAc88 } from "./sanyo_ac88";
import { sharpAc } from "./sharp_ac";
import { tcl112ac } from "./tcl112ac";
import { technibelAc } from "./technibel_ac";
import { teco } from "./teco";
import { teknopoint } from "./teknopoint";
import { toshibaAc } from "./toshiba_ac";
import { transcold } from "./transcold";
import { trotec } from "./trotec";
import { trotec3550 } from "./trotec_3550";
import { truma } from "./truma";
import { vestelAc } from "./vestel_ac";
import { voltas } from "./voltas";
import { whirlpoolAc } from "./whirlpool_ac";
import { york } from "./york";

export const PROTOCOLS: AcProtocol[] = [
  airton,
  airwell,
  amcor,
  argo,
  bosch144,
  carrierAc64,
  coolix,
  coronaAc,
  daikin,
  daikin128,
  daikin152,
  daikin160,
  daikin176,
  daikin2,
  daikin216,
  daikin312,
  daikin64,
  delonghiAc,
  ecoclim,
  electraAc,
  eurom,
  fujitsuAc,
  goodweather,
  gree,
  haierAc,
  haierAc160,
  haierAc176,
  haierAcYrw02,
  hitachiAc,
  hitachiAc1,
  hitachiAc264,
  hitachiAc296,
  hitachiAc344,
  hitachiAc424,
  kelon,
  kelon168,
  kelvinator,
  lg,
  lg2,
  midea,
  mirage,
  mitsubishi112,
  mitsubishi136,
  mitsubishiAc,
  mitsubishiHeavy152,
  mitsubishiHeavy88,
  neoclima,
  panasonicAc,
  panasonicAc32,
  rhoss,
  samsungAc,
  sanyoAc,
  sanyoAc88,
  sharpAc,
  tcl112ac,
  technibelAc,
  teco,
  teknopoint,
  toshibaAc,
  transcold,
  trotec,
  trotec3550,
  truma,
  vestelAc,
  voltas,
  whirlpoolAc,
  york,
].sort((a, b) => a.name.localeCompare(b.name));
