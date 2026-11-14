"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lf2HoverProvider = exports.Lf2FoldingRangeProvider = exports.Lf2DocumentSymbolProvider = void 0;
const vscode = __importStar(require("vscode"));
const BLOCK_PAIRS = [
    [/^\s*<bmp_begin>/i, /^\s*<bmp_end>/i],
    [/^\s*<frame>\b/i, /^\s*<frame_end>/i],
    [/^\s*<object>/i, /^\s*<object_end>/i],
    [/^\s*<background>/i, /^\s*<background_end>/i],
    [/^\s*<file_editing>/i, /^\s*<file_editing_end>/i],
    [/^\s*<stage>/i, /^\s*<stage_end>/i],
    [/^\s*<phase>/i, /^\s*<phase_end>/i],
    [/^\s*<weapon_strength_list>/i, /^\s*<weapon_strength_list_end>/i],
    [/^\s*bdy:/i, /^\s*bdy_end:/i],
    [/^\s*itr:/i, /^\s*itr_end:/i],
    [/^\s*opoint:/i, /^\s*opoint_end:/i],
    [/^\s*wpoint:/i, /^\s*wpoint_end:/i],
    [/^\s*cpoint:/i, /^\s*cpoint_end:/i]
];
const HOVER_DOCS = {
    state: '**state** — Stan zachowania postaci w tej klatce (np. `0`: stanie, `1`: chodzenie, `2`: bieg, `3`: atak, `4`: skok, `7`: blok, `12`: upadek, `16`: zranienie, `3000`: specjalny obiekt).',
    kind: '**kind** — Typ hitboxa `itr` / `bdy` / `opoint` (np. `itr kind: 0` zwykły atak, `1` łapanie, `3` wymuszone złapanie, `8` leczenie, `9` tarcza/odbicie).',
    effect: '**effect** — Efekt wizualno-dźwiękowy trafienia (`0`: zwykłe uderzenie, `1`: cięcie/krew, `2`: ogień, `3`: lód, `4`: brak iskier/przebicie, `20`: spalenie ogniem, `30`: zamrożenie).',
    bdy: '**bdy** — *Body box*: prostokąt określający obszar, w którym obiekt może otrzymać obrażenia.',
    itr: '**itr** — *Interaction box*: prostokąt ataku lub interakcji zadający obrażenia/efekty.',
    opoint: '**opoint** — *Object point*: punkt tworzący inny obiekt (np. pocisk, falę energii, efekt).',
    wpoint: '**wpoint** — *Weapon point*: punkt trzymania broni w dłoni postaci.',
    cpoint: '**cpoint** — *Catch point*: punkt przetrzymywania złapanego przeciwnika.',
    vrest: '**vrest** — Liczba klatek przerwy przed ponownym trafieniem tego samego celu (zapobiega wielokrotnym trafieniom w jednej klatce).',
    arest: '**arest** — Liczba klatek przerwy przed trafieniem kolejnego celu.',
    bdefend: '**bdefend** — Siła przełamania bloku (standardowo `16` = zwykły blok; `>= 60` przełamuje obronę).',
    fall: '**fall** — Siła powalenia (`70` od razu przewraca cel; mniejsze wartości kumulują się).'
};
class Lf2DocumentSymbolProvider {
    provideDocumentSymbols(document) {
        const symbols = [];
        let currentFrame = null;
        let frameStartLine = 0;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();
            const frameMatch = /^<frame>\s+(\d+)(?:\s+(.*))?$/i.exec(text);
            if (frameMatch) {
                const label = `Frame ${frameMatch[1]}${frameMatch[2] ? ` (${frameMatch[2].trim()})` : ''}`;
                frameStartLine = i;
                currentFrame = new vscode.DocumentSymbol(label, 'LF2 Frame', vscode.SymbolKind.Function, line.range, line.range);
                continue;
            }
            if (/^<frame_end>/i.test(text) && currentFrame) {
                const fullRange = new vscode.Range(frameStartLine, 0, i, line.text.length);
                currentFrame.range = fullRange;
                symbols.push(currentFrame);
                currentFrame = null;
                continue;
            }
            const sectionMatch = /^<(bmp_begin|object|background|stage|phase|weapon_strength_list)>/i.exec(text);
            if (sectionMatch) {
                symbols.push(new vscode.DocumentSymbol(`<${sectionMatch[1]}>`, 'Sekcja LF2', vscode.SymbolKind.Namespace, line.range, line.range));
            }
            if (currentFrame) {
                const subMatch = /^(bdy|itr|opoint|wpoint|cpoint):/i.exec(text);
                if (subMatch) {
                    currentFrame.children.push(new vscode.DocumentSymbol(subMatch[1], 'Punkt/Obszar', vscode.SymbolKind.Struct, line.range, line.range));
                }
            }
        }
        if (currentFrame) {
            symbols.push(currentFrame);
        }
        return symbols;
    }
}
exports.Lf2DocumentSymbolProvider = Lf2DocumentSymbolProvider;
class Lf2FoldingRangeProvider {
    provideFoldingRanges(document) {
        const ranges = [];
        const stacks = BLOCK_PAIRS.map(() => []);
        for (let i = 0; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;
            for (let p = 0; p < BLOCK_PAIRS.length; p++) {
                const [startRe, endRe] = BLOCK_PAIRS[p];
                if (startRe.test(text)) {
                    stacks[p].push(i);
                }
                else if (endRe.test(text)) {
                    const startLine = stacks[p].pop();
                    if (startLine !== undefined && i > startLine) {
                        ranges.push(new vscode.FoldingRange(startLine, i));
                    }
                }
            }
        }
        return ranges;
    }
}
exports.Lf2FoldingRangeProvider = Lf2FoldingRangeProvider;
class Lf2HoverProvider {
    provideHover(document, position) {
        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]+/);
        if (!wordRange)
            return undefined;
        const word = document.getText(wordRange).toLowerCase();
        const doc = HOVER_DOCS[word];
        if (!doc)
            return undefined;
        return new vscode.Hover(new vscode.MarkdownString(doc), wordRange);
    }
}
exports.Lf2HoverProvider = Lf2HoverProvider;
//# sourceMappingURL=lf2LanguageFeatures.js.map