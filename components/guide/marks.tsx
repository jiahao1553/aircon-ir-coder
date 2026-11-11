import Image from "next/image";
import broadlink from "@/public/logos/broadlink.jpg";
import esphome from "@/public/logos/esphome.png";
import flipper from "@/public/logos/flipper.png";
import lookin from "@/public/logos/lookin.png";
import mqtt from "@/public/logos/mqtt.png";
import tuya from "@/public/logos/tuya.png";
import xiaomi from "@/public/logos/xiaomi.png";
import zha from "@/public/logos/zha.png";

const square = "h-8 w-8";

// Drawn to match public/logos/aircon.png, which stays the browser-tab icon.
export function AirconMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" fill="#144D2D" />
      <g fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round">
        <path d="M404 224A32 32 0 0 0 372 192" />
        <path d="M427 224A55 55 0 0 0 372 169" />
        <path d="M451 224A79 79 0 0 0 372 145" />
      </g>
      <rect x="103" y="209" width="283" height="131" rx="22" fill="#fff" />
      <rect x="123" y="305" width="242" height="16" rx="8" fill="#144D2D" />
    </svg>
  );
}

export function BroadlinkMark() {
  return <Image src={broadlink} alt="" className={square} draggable={false} unoptimized />;
}

export function TuyaMark() {
  return <Image src={tuya} alt="" className={square} draggable={false} unoptimized />;
}

export function EsphomeMark() {
  return <Image src={esphome} alt="" className={square} draggable={false} unoptimized />;
}

export function FlipperMark() {
  return <Image src={flipper} alt="" className={square} draggable={false} unoptimized />;
}

export function LookinMark() {
  return <Image src={lookin} alt="" className={square} draggable={false} unoptimized />;
}

export function XiaomiMark() {
  return <Image src={xiaomi} alt="" className={square} draggable={false} unoptimized />;
}

export function MqttMark() {
  return <Image src={mqtt} alt="" className={square} draggable={false} unoptimized />;
}

export function ZigbeeMark() {
  return <Image src={zha} alt="" className={square} draggable={false} unoptimized />;
}
