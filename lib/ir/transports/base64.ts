export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const clean = value.replace(/\s+/g, "");
  if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) throw new Error("That text is not Base64.");
  const binary = atob(clean);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
