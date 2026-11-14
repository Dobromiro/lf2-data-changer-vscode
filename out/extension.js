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
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const lf2Cipher_1 = require("./lf2Cipher");
const lf2FileSystemProvider_1 = require("./lf2FileSystemProvider");
const lf2LanguageFeatures_1 = require("./lf2LanguageFeatures");
const openingInProgress = new Set();
async function openUriAsLf2Dat(realUri) {
    const virtualUri = (0, lf2FileSystemProvider_1.toVirtualLf2Uri)(realUri);
    const doc = await vscode.workspace.openTextDocument(virtualUri);
    const styledDoc = await vscode.languages.setTextDocumentLanguage(doc, 'lf2dc');
    await vscode.window.showTextDocument(styledDoc, { preview: false });
}
function getTabUri(tab) {
    if (tab.input instanceof vscode.TabInputText) {
        return tab.input.uri;
    }
    if (tab.input instanceof vscode.TabInputCustom) {
        return tab.input.uri;
    }
    return undefined;
}
function activate(context) {
    const fsProvider = new lf2FileSystemProvider_1.Lf2FileSystemProvider();
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider(lf2FileSystemProvider_1.LF2_SCHEME, fsProvider, {
        isCaseSensitive: process.platform !== 'win32'
    }));
    const selector = [
        { language: 'lf2dc', scheme: lf2FileSystemProvider_1.LF2_SCHEME },
        { language: 'lf2dc', scheme: 'file' }
    ];
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, new lf2LanguageFeatures_1.Lf2DocumentSymbolProvider()), vscode.languages.registerFoldingRangeProvider(selector, new lf2LanguageFeatures_1.Lf2FoldingRangeProvider()), vscode.languages.registerHoverProvider(selector, new lf2LanguageFeatures_1.Lf2HoverProvider()));
    // Automatyczne przejęcie klikniętych plików .dat w Eksploratorze
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(async (event) => {
        const autoOpen = vscode.workspace
            .getConfiguration('lf2dc')
            .get('autoOpenDatFiles', true);
        if (!autoOpen)
            return;
        for (const tab of event.opened) {
            const uri = getTabUri(tab);
            if (!uri || uri.scheme !== 'file')
                continue;
            if (!uri.fsPath.toLowerCase().endsWith('.dat'))
                continue;
            if (openingInProgress.has(uri.fsPath))
                continue;
            openingInProgress.add(uri.fsPath);
            try {
                const bytes = await vscode.workspace.fs.readFile(uri);
                if ((0, lf2Cipher_1.looksLikeLf2Dat)(bytes)) {
                    await vscode.window.tabGroups.close(tab, true);
                    await openUriAsLf2Dat(uri);
                }
            }
            catch {
                // Ignoruj błędy odczytu nie-LF2 plików
            }
            finally {
                openingInProgress.delete(uri.fsPath);
            }
        }
    }));
    // Komenda: otwórz dowolny .dat jako LF2 Data Changer
    context.subscriptions.push(vscode.commands.registerCommand('lf2dc.openDat', async (resource) => {
        let target = resource;
        if (!target) {
            const picked = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'LF2 Data Files': ['dat'] },
                openLabel: 'Open in LF2 Data Changer'
            });
            target = picked?.[0];
        }
        if (!target)
            return;
        await openUriAsLf2Dat(target.scheme === lf2FileSystemProvider_1.LF2_SCHEME ? (0, lf2FileSystemProvider_1.toRealFileUri)(target) : target);
    }));
    // Komenda: szybkie otwieranie plików na podstawie data/data.txt (jak w LF2DC)
    context.subscriptions.push(vscode.commands.registerCommand('lf2dc.quickOpenFromDataTxt', async () => {
        const found = await vscode.workspace.findFiles('**/data/data.txt', '**/node_modules/**', 5);
        if (found.length === 0) {
            vscode.window.showWarningMessage('Nie znaleziono pliku data/data.txt w obecnym workspace.');
            return;
        }
        const dataTxtUri = found[0];
        const bytes = await vscode.workspace.fs.readFile(dataTxtUri);
        const content = Buffer.from(bytes).toString('utf8');
        const lf2Root = path.dirname(path.dirname(dataTxtUri.fsPath));
        const items = [];
        const regex = /(?:id:\s*(\d+)\s+)?(?:type:\s*(\d+)\s+)?file:\s*([^\s\r\n]+)/gi;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const rel = match[3].replace(/\\/g, path.sep);
            const abs = path.join(lf2Root, rel);
            items.push({
                label: path.basename(rel),
                description: `${match[1] ? `id: ${match[1]}  ` : ''}${match[2] ? `type: ${match[2]}  ` : ''}${match[3]}`,
                filePath: abs
            });
        }
        if (items.length === 0) {
            vscode.window.showInformationMessage('Brak wpisów file: w data.txt.');
            return;
        }
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Wybierz plik postaci/obiektu/tła z data.txt'
        });
        if (!selected)
            return;
        await openUriAsLf2Dat(vscode.Uri.file(selected.filePath));
    }));
    // Komenda: eksport odszyfrowanej kopii .txt
    context.subscriptions.push(vscode.commands.registerCommand('lf2dc.exportPlaintext', async (resource) => {
        const uri = resource ?? vscode.window.activeTextEditor?.document.uri;
        if (!uri)
            return;
        const realUri = uri.scheme === lf2FileSystemProvider_1.LF2_SCHEME ? (0, lf2FileSystemProvider_1.toRealFileUri)(uri) : uri;
        const raw = await vscode.workspace.fs.readFile(realUri);
        const plain = (0, lf2Cipher_1.looksLikeLf2Dat)(raw) ? (0, lf2Cipher_1.decryptBufferRaw)(raw) : raw;
        const outUri = vscode.Uri.file(`${realUri.fsPath}.txt`);
        await vscode.workspace.fs.writeFile(outUri, plain);
        const doc = await vscode.workspace.openTextDocument(outUri);
        await vscode.window.showTextDocument(doc);
    }));
    // Komenda: zaszyfruj aktywny plik tekstowy do .dat
    context.subscriptions.push(vscode.commands.registerCommand('lf2dc.encryptCurrentToDat', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const textBytes = Buffer.from(editor.document.getText(), 'utf8');
        const encrypted = (0, lf2Cipher_1.encryptBufferRaw)(textBytes);
        const defaultUri = vscode.Uri.file(editor.document.uri.fsPath.replace(/\.txt$/i, '') +
            (editor.document.uri.fsPath.toLowerCase().endsWith('.dat') ? '' : '.dat'));
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'LF2 Data Files': ['dat'] }
        });
        if (!saveUri)
            return;
        await vscode.workspace.fs.writeFile(saveUri, encrypted);
        vscode.window.showInformationMessage(`Zapisano zaszyfrowany plik: ${path.basename(saveUri.fsPath)}`);
    }));
    // Komenda: utwórz nowy szablon AI.as (z LF2DCWindowsNoWTE/templates/AI.as)
    context.subscriptions.push(vscode.commands.registerCommand('lf2dc.createAiTemplate', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'cpp',
            content: [
                'int ego(){',
                '    //ego here',
                '    ',
                '    return 0;',
                '}',
                '',
                'void id(){',
                '    //id here',
                '    ',
                '    if(ego() == 0){',
                '        //superego here',
                '    }',
                '}',
                ''
            ].join('\n')
        });
        await vscode.window.showTextDocument(doc);
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map