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
exports.Lf2FileSystemProvider = exports.LF2_SCHEME = void 0;
exports.toRealFileUri = toRealFileUri;
exports.toVirtualLf2Uri = toVirtualLf2Uri;
const vscode = __importStar(require("vscode"));
const lf2Cipher_1 = require("./lf2Cipher");
exports.LF2_SCHEME = 'lf2dat';
function toRealFileUri(virtualUri) {
    return virtualUri.with({ scheme: 'file' });
}
function toVirtualLf2Uri(realUri) {
    return realUri.with({ scheme: exports.LF2_SCHEME });
}
class Lf2FileSystemProvider {
    _onDidChangeFile = new vscode.EventEmitter();
    onDidChangeFile = this._onDidChangeFile.event;
    watch(_uri) {
        return new vscode.Disposable(() => { });
    }
    async stat(uri) {
        const realStat = await vscode.workspace.fs.stat(toRealFileUri(uri));
        return {
            ...realStat,
            size: Math.max(0, realStat.size - lf2Cipher_1.LF2_HEADER_SIZE)
        };
    }
    async readDirectory(uri) {
        return vscode.workspace.fs.readDirectory(toRealFileUri(uri));
    }
    async createDirectory(uri) {
        return vscode.workspace.fs.createDirectory(toRealFileUri(uri));
    }
    async readFile(uri) {
        const realUri = toRealFileUri(uri);
        const raw = await vscode.workspace.fs.readFile(realUri);
        return (0, lf2Cipher_1.decryptLf2File)(raw, realUri.fsPath);
    }
    async writeFile(uri, content, _options) {
        const realUri = toRealFileUri(uri);
        const encrypted = (0, lf2Cipher_1.encryptLf2File)(content, realUri.fsPath);
        await vscode.workspace.fs.writeFile(realUri, encrypted);
        this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
        vscode.window.setStatusBarMessage(`LF2DC: Zaszyfrowano i zapisano ${realUri.path.split('/').pop()}`, 3000);
    }
    async delete(uri, options) {
        return vscode.workspace.fs.delete(toRealFileUri(uri), options);
    }
    async rename(oldUri, newUri, options) {
        return vscode.workspace.fs.rename(toRealFileUri(oldUri), toRealFileUri(newUri), options);
    }
}
exports.Lf2FileSystemProvider = Lf2FileSystemProvider;
//# sourceMappingURL=lf2FileSystemProvider.js.map