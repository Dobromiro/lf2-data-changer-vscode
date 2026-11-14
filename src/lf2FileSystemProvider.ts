import * as vscode from 'vscode';
import { decryptLf2File, encryptLf2File, LF2_HEADER_SIZE } from './lf2Cipher';

export const LF2_SCHEME = 'lf2dat';

export function toRealFileUri(virtualUri: vscode.Uri): vscode.Uri {
  return virtualUri.with({ scheme: 'file' });
}

export function toVirtualLf2Uri(realUri: vscode.Uri): vscode.Uri {
  return realUri.with({ scheme: LF2_SCHEME });
}

export class Lf2FileSystemProvider implements vscode.FileSystemProvider {
  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event;

  watch(_uri: vscode.Uri): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const realStat = await vscode.workspace.fs.stat(toRealFileUri(uri));
    return {
      ...realStat,
      size: Math.max(0, realStat.size - LF2_HEADER_SIZE)
    };
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    return vscode.workspace.fs.readDirectory(toRealFileUri(uri));
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    return vscode.workspace.fs.createDirectory(toRealFileUri(uri));
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const realUri = toRealFileUri(uri);
    const raw = await vscode.workspace.fs.readFile(realUri);
    return decryptLf2File(raw, realUri.fsPath);
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { readonly create: boolean; readonly overwrite: boolean }
  ): Promise<void> {
    const realUri = toRealFileUri(uri);
    const encrypted = encryptLf2File(content, realUri.fsPath);
    await vscode.workspace.fs.writeFile(realUri, encrypted);
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    vscode.window.setStatusBarMessage(
      `LF2DC: Zaszyfrowano i zapisano ${realUri.path.split('/').pop()}`,
      3000
    );
  }

  async delete(uri: vscode.Uri, options: { readonly recursive: boolean }): Promise<void> {
    return vscode.workspace.fs.delete(toRealFileUri(uri), options);
  }

  async rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean }
  ): Promise<void> {
    return vscode.workspace.fs.rename(toRealFileUri(oldUri), toRealFileUri(newUri), options);
  }
}