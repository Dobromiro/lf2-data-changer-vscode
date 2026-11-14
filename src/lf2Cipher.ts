const LF2_KEY = Buffer.from('SiuHungIsAGoodBearBecauseHeIsVeryGood', 'ascii');
export const LF2_HEADER_SIZE = 123;

// Zapamiętujemy oryginalne 123-bajtowe nagłówki per ścieżka pliku
const headerCache = new Map<string, Uint8Array>();

const LF2_SIGNATURES = [
  '<bmp_begin>',
  '<frame>',
  '<stage>',
  '<phase>',
  '<object>',
  '<background>',
  '<weapon_strength_list>',
  'walking_frame_rate',
  'walking_speed'
];

function printableRatio(buf: Uint8Array, start: number, maxLen: number): number {
  const end = Math.min(buf.length, start + maxLen);
  if (end <= start) return 0;

  let printable = 0;
  for (let i = start; i < end; i++) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) {
      printable++;
    }
  }
  return printable / (end - start);
}

function containsLf2Signature(text: string): boolean {
  const lower = text.toLowerCase();
  return LF2_SIGNATURES.some((sig) => lower.includes(sig));
}

export function decryptBufferRaw(cipher: Uint8Array): Uint8Array {
  if (cipher.length <= LF2_HEADER_SIZE) {
    return new Uint8Array(0);
  }
  const out = new Uint8Array(cipher.length - LF2_HEADER_SIZE);
  for (let i = LF2_HEADER_SIZE; i < cipher.length; i++) {
    const k = LF2_KEY[i % LF2_KEY.length];
    out[i - LF2_HEADER_SIZE] = (cipher[i] - k + 256) & 0xff;
  }
  return out;
}

export function encryptBufferRaw(plain: Uint8Array, header?: Uint8Array): Uint8Array {
  const out = new Uint8Array(LF2_HEADER_SIZE + plain.length);

  if (header && header.length === LF2_HEADER_SIZE) {
    out.set(header, 0);
  } else {
    // Domyślny 123-bajtowy nagłówek (zaszyfrowane spacje, w pełni zgodne z lf2.exe)
    for (let i = 0; i < LF2_HEADER_SIZE; i++) {
      out[i] = (0x20 + LF2_KEY[i % LF2_KEY.length]) & 0xff;
    }
  }

  for (let j = 0; j < plain.length; j++) {
    const i = LF2_HEADER_SIZE + j;
    const k = LF2_KEY[i % LF2_KEY.length];
    out[i] = (plain[j] + k) & 0xff;
  }
  return out;
}

export function looksLikeLf2Dat(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;

  // Sprawdź czy plik jest już jawnym tekstem LF2
  const rawSample = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024))).toString('utf8');
  if (printableRatio(bytes, 0, 512) > 0.9 && containsLf2Signature(rawSample)) {
    return true;
  }

  // Sprawdź po odszyfrowaniu LF2
  if (bytes.length > LF2_HEADER_SIZE) {
    const dec = decryptBufferRaw(bytes.subarray(0, Math.min(bytes.length, LF2_HEADER_SIZE + 1024)));
    const decRatio = printableRatio(dec, 0, 512);
    const decSample = Buffer.from(dec).toString('utf8');
    if (decRatio > 0.85 && containsLf2Signature(decSample)) {
      return true;
    }
  }

  return false;
}

export function decryptLf2File(bytes: Uint8Array, cacheKey: string): Uint8Array {
  // Jeśli plik jest już odszyfrowanym tekstem LF2, nie usuwaj pierwszych 123 bajtów
  const rawSample = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024))).toString('utf8');
  if (printableRatio(bytes, 0, 512) > 0.9 && containsLf2Signature(rawSample)) {
    return bytes;
  }

  if (bytes.length >= LF2_HEADER_SIZE) {
    headerCache.set(cacheKey, new Uint8Array(bytes.subarray(0, LF2_HEADER_SIZE)));
  }
  return decryptBufferRaw(bytes);
}

export function encryptLf2File(plain: Uint8Array, cacheKey: string): Uint8Array {
  const header = headerCache.get(cacheKey);
  return encryptBufferRaw(plain, header);
}