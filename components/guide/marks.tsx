// Xiaomi, MQTT and Zigbee paths are the Simple Icons marks (CC0).
// Broadlink, Tuya, ESPHome, LOOKin and Flipper are the brands' own logos, kept in public/logos.

const square = "h-8 w-8";

export function BroadlinkMark() {
  return <img src="/logos/broadlink.jpg" alt="" className={square} draggable={false} />;
}

export function TuyaMark() {
  return <img src="/logos/tuya.png" alt="" className={square} draggable={false} />;
}

export function EsphomeMark() {
  return <img src="/logos/esphome.png" alt="" className={square} draggable={false} />;
}

export function FlipperMark() {
  return <img src="/logos/flipper.png" alt="" className={square} draggable={false} />;
}

export function LookinMark() {
  return <img src="/logos/lookin.png" alt="" className={square} draggable={false} />;
}

export function XiaomiMark() {
  return (
    <svg viewBox="0 0 24 24" className={square} aria-hidden>
      <path
        fill="#FF6900"
        fillRule="evenodd"
        d="M12 0C8.016 0 4.756.255 2.493 2.516.23 4.776 0 8.033 0 12.012c0 3.98.23 7.235 2.494 9.497C4.757 23.77 8.017 24 12 24c3.983 0 7.243-.23 9.506-2.491C23.77 19.247 24 15.99 24 12.012c0-3.984-.233-7.243-2.502-9.504C19.234.252 15.978 0 12 0zM4.906 7.405h5.624c1.47 0 3.007.068 3.764.827.746.746.827 2.233.83 3.676v4.54a.15.15 0 0 1-.152.147h-1.947a.15.15 0 0 1-.152-.148V11.83c-.002-.806-.048-1.634-.464-2.051-.358-.36-1.026-.441-1.72-.458H7.158a.15.15 0 0 0-.151.147v6.98a.15.15 0 0 1-.152.148H4.906a.15.15 0 0 1-.15-.148V7.554a.15.15 0 0 1 .15-.149zm12.131 0h1.949a.15.15 0 0 1 .15.15v8.892a.15.15 0 0 1-.15.148h-1.949a.15.15 0 0 1-.151-.148V7.554a.15.15 0 0 1 .151-.149zM8.92 10.948h2.046c.083 0 .15.066.15.147v5.352a.15.15 0 0 1-.15.148H8.92a.15.15 0 0 1-.152-.148v-5.352a.15.15 0 0 1 .152-.147Z"
      />
    </svg>
  );
}

export function MqttMark() {
  return (
    <svg viewBox="0 0 24 24" className={square} aria-hidden>
      <path
        fill="#660066"
        d="M10.657 23.994h-9.45A1.212 1.212 0 0 1 0 22.788v-9.18h.071c5.784 0 10.504 4.65 10.586 10.386Zm7.606 0h-4.045C14.135 16.246 7.795 9.977 0 9.942V6.038h.071c9.983 0 18.121 8.044 18.192 17.956Zm4.53 0h-.97C21.754 12.071 11.995 2.407 0 2.372v-1.16C0 .55.544.006 1.207.006h7.64C15.733 2.49 21.257 7.789 24 14.508v8.291c0 .663-.544 1.195-1.207 1.195ZM16.713.006h6.092A1.19 1.19 0 0 1 24 1.2v5.914c-.91-1.242-2.046-2.65-3.158-3.762C19.588 2.11 18.122.987 16.714.005Z"
      />
    </svg>
  );
}

export function ZigbeeMark() {
  return (
    <svg viewBox="0 0 24 24" className={square} aria-hidden>
      <path
        fill="#EB0443"
        fillRule="evenodd"
        d="M11.988 0a11.85 11.85 0 00-8.617 3.696c7.02-.875 11.401-.583 13.289-.34 3.752.583 3.558 3.404 3.558 3.404L8.237 19.112c2.299.22 6.897.366 13.796-.631a11.86 11.86 0 001.912-6.469C23.945 5.374 18.595 0 11.988 0zm.232 4.31c-2.451-.014-5.772.146-9.963.723C.854 7.003.055 9.41.055 12.012.055 18.626 5.38 24 11.988 24c3.63 0 6.85-1.63 9.053-4.182-7.286.948-11.813.631-13.75.388-3.775-.56-3.557-3.404-3.557-3.404L15.691 4.474a38.635 38.635 0 00-3.471-.163Z"
      />
    </svg>
  );
}
