const CODE = /^[A-Za-z0-9][A-Za-z0-9.+*_~/-]*$/;
const STOP = /^(unknown|unknow|models?|inverter|remote|series|smart|wifi|swing|health|control|box)$/i;

/** Pulls model codes out of SmartIR `supportedModels` text. Drops prose and "Unknown". */
export function modelCodes(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const cleaned = item.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
    for (const part of cleaned.split(/\s*,\s*|\s*;\s*|\s+\/\s+|\s+\bor\b\s+/i)) {
      const words = part.trim().split(/\s+/).filter(Boolean);
      if (!words.length || words.length > 4 || words.some((w) => STOP.test(w) || !CODE.test(w))) continue;
      const code = words.join(" ");
      if (!/[A-Za-z]/.test(code) || !/[\d*]/.test(code)) continue;
      out.push(code);
    }
  }
  return [...new Set(out)];
}
