"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LF2_HEADER_SIZE = void 0;
exports.decryptBufferRaw = decryptBufferRaw;
exports.encryptBufferRaw = encryptBufferRaw;
exports.looksLikeLf2Dat = looksLikeLf2Dat;
exports.decryptLf2File = decryptLf2File;
exports.encryptLf2File = encryptLf2File;
const LF2_KEY = Buffer.from('SiuHungIsAGoodBearBecauseHeIsVeryGood', 'ascii');
exports.LF2_HEADER_SIZE = 123;
// Zapamiętujemy oryginalne 123-bajtowe nagłówki per ścieżka pliku
const headerCache = new Map();
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
function printableRatio(buf, start, maxLen) {
    const end = Math.min(buf.length, start + maxLen);
    if (end <= start)
        return 0;
    let printable = 0;
    for (let i = start; i < end; i++) {
        const b = buf[i];
        if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) {
            printable++;
        }
    }
    return printable / (end - start);
}
function containsLf2Signature(text) {
    const lower = text.toLowerCase();
    return LF2_SIGNATURES.some((sig) => lower.includes(sig));
}
function decryptBufferRaw(cipher) {
    if (cipher.length <= exports.LF2_HEADER_SIZE) {
        return new Uint8Array(0);
    }
    const out = new Uint8Array(cipher.length - exports.LF2_HEADER_SIZE);
    for (let i = exports.LF2_HEADER_SIZE; i < cipher.length; i++) {
        const k = LF2_KEY[i % LF2_KEY.length];
        out[i - exports.LF2_HEADER_SIZE] = (cipher[i] - k + 256) & 0xff;
    }
    return out;
}
function encryptBufferRaw(plain, header) {
    const out = new Uint8Array(exports.LF2_HEADER_SIZE + plain.length);
    if (header && header.length === exports.LF2_HEADER_SIZE) {
        out.set(header, 0);
    }
    else {
        // Domyślny 123-bajtowy nagłówek (zaszyfrowane spacje, w pełni zgodne z lf2.exe)
        for (let i = 0; i < exports.LF2_HEADER_SIZE; i++) {
            out[i] = (0x20 + LF2_KEY[i % LF2_KEY.length]) & 0xff;
        }
    }
    for (let j = 0; j < plain.length; j++) {
        const i = exports.LF2_HEADER_SIZE + j;
        const k = LF2_KEY[i % LF2_KEY.length];
        out[i] = (plain[j] + k) & 0xff;
    }
    return out;
}
function looksLikeLf2Dat(bytes) {
    if (bytes.length === 0)
        return false;
    // Sprawdź czy plik jest już jawnym tekstem LF2
    const rawSample = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024))).toString('utf8');
    if (printableRatio(bytes, 0, 512) > 0.9 && containsLf2Signature(rawSample)) {
        return true;
    }
    // Sprawdź po odszyfrowaniu LF2
    if (bytes.length > exports.LF2_HEADER_SIZE) {
        const dec = decryptBufferRaw(bytes.subarray(0, Math.min(bytes.length, exports.LF2_HEADER_SIZE + 1024)));
        const decRatio = printableRatio(dec, 0, 512);
        const decSample = Buffer.from(dec).toString('utf8');
        if (decRatio > 0.85 && containsLf2Signature(decSample)) {
            return true;
        }
    }
    return false;
}
function decryptLf2File(bytes, cacheKey) {
    // Jeśli plik jest już odszyfrowanym tekstem LF2, nie usuwaj pierwszych 123 bajtów
    const rawSample = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024))).toString('utf8');
    if (printableRatio(bytes, 0, 512) > 0.9 && containsLf2Signature(rawSample)) {
        return bytes;
    }
    if (bytes.length >= exports.LF2_HEADER_SIZE) {
        headerCache.set(cacheKey, new Uint8Array(bytes.subarray(0, exports.LF2_HEADER_SIZE)));
    }
    return decryptBufferRaw(bytes);
}
function encryptLf2File(plain, cacheKey) {
    const header = headerCache.get(cacheKey);
    return encryptBufferRaw(plain, header);
}
//# sourceMappingURL=lf2Cipher.js.map