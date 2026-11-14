import * as path from 'path';
import * as vscode from 'vscode';
import {
  decryptBufferRaw,
  encryptBufferRaw,
  looksLikeLf2Dat
} from './lf2Cipher';
import {
  LF2_SCHEME,
  Lf2FileSystemProvider,
  toRealFileUri,
  toVirtualLf2Uri
} from './lf2FileSystemProvider';
import {
  Lf2DocumentSymbolProvider,
  Lf2FoldingRangeProvider,
  Lf2HoverProvider
} from './lf2LanguageFeatures';

const openingInProgress = new Set<string>();

async function openUriAsLf2Dat(realUri: vscode.Uri): Promise<void> {
  const virtualUri = toVirtualLf2Uri(realUri);
  const doc = await vscode.workspace.openTextDocument(virtualUri);
  const styledDoc = await vscode.languages.setTextDocumentLanguage(doc, 'lf2dc');
  await vscode.window.showTextDocument(styledDoc, { preview: false });
}

function getTabUri(tab: vscode.Tab): vscode.Uri | undefined {
  if (tab.input instanceof vscode.TabInputText) {
    return tab.input.uri;
  }
  if (tab.input instanceof vscode.TabInputCustom) {
    return tab.input.uri;
  }
  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  const fsProvider = new Lf2FileSystemProvider();

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(LF2_SCHEME, fsProvider, {
      isCaseSensitive: process.platform !== 'win32'
    })
  );

  const selector: vscode.DocumentSelector = [
    { language: 'lf2dc', scheme: LF2_SCHEME },
    { language: 'lf2dc', scheme: 'file' }
  ];

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, new Lf2DocumentSymbolProvider()),
    vscode.languages.registerFoldingRangeProvider(selector, new Lf2FoldingRangeProvider()),
    vscode.languages.registerHoverProvider(selector, new Lf2HoverProvider())
  );

  // Automatyczne przejęcie klikniętych plików .dat w Eksploratorze
  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(async (event) => {
      const autoOpen = vscode.workspace
        .getConfiguration('lf2dc')
        .get<boolean>('autoOpenDatFiles', true);
      if (!autoOpen) return;

      for (const tab of event.opened) {
        const uri = getTabUri(tab);
        if (!uri || uri.scheme !== 'file') continue;
        if (!uri.fsPath.toLowerCase().endsWith('.dat')) continue;
        if (openingInProgress.has(uri.fsPath)) continue;

        openingInProgress.add(uri.fsPath);
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          if (looksLikeLf2Dat(bytes)) {
            await vscode.window.tabGroups.close(tab, true);
            await openUriAsLf2Dat(uri);
          }
        } catch {
          // Ignoruj błędy odczytu nie-LF2 plików
        } finally {
          openingInProgress.delete(uri.fsPath);
        }
      }
    })
  );

  // Komenda: otwórz dowolny .dat jako LF2 Data Changer
  context.subscriptions.push(
    vscode.commands.registerCommand('lf2dc.openDat', async (resource?: vscode.Uri) => {
      let target = resource;
      if (!target) {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'LF2 Data Files': ['dat'] },
          openLabel: 'Open in LF2 Data Changer'
        });
        target = picked?.[0];
      }
      if (!target) return;
      await openUriAsLf2Dat(target.scheme === LF2_SCHEME ? toRealFileUri(target) : target);
    })
  );

  // Komenda: szybkie otwieranie plików na podstawie data/data.txt (jak w LF2DC)
  context.subscriptions.push(
    vscode.commands.registerCommand('lf2dc.quickOpenFromDataTxt', async () => {
      const found = await vscode.workspace.findFiles('**/data/data.txt', '**/node_modules/**', 5);
      if (found.length === 0) {
        vscode.window.showWarningMessage('Nie znaleziono pliku data/data.txt w obecnym workspace.');
        return;
      }

      const dataTxtUri = found[0];
      const bytes = await vscode.workspace.fs.readFile(dataTxtUri);
      const content = Buffer.from(bytes).toString('utf8');
      const lf2Root = path.dirname(path.dirname(dataTxtUri.fsPath));

      interface EntryItem extends vscode.QuickPickItem {
        filePath: string;
      }
      const items: EntryItem[] = [];
      const regex = /(?:id:\s*(\d+)\s+)?(?:type:\s*(\d+)\s+)?file:\s*([^\s\r\n]+)/gi;
      let match: RegExpExecArray | null;

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
      if (!selected) return;

      await openUriAsLf2Dat(vscode.Uri.file(selected.filePath));
    })
  );

  // Komenda: eksport odszyfrowanej kopii .txt
  context.subscriptions.push(
    vscode.commands.registerCommand('lf2dc.exportPlaintext', async (resource?: vscode.Uri) => {
      const uri = resource ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri) return;

      const realUri = uri.scheme === LF2_SCHEME ? toRealFileUri(uri) : uri;
      const raw = await vscode.workspace.fs.readFile(realUri);
      const plain = looksLikeLf2Dat(raw) ? decryptBufferRaw(raw) : raw;

      const outUri = vscode.Uri.file(`${realUri.fsPath}.txt`);
      await vscode.workspace.fs.writeFile(outUri, plain);
      const doc = await vscode.workspace.openTextDocument(outUri);
      await vscode.window.showTextDocument(doc);
    })
  );

  // Komenda: zaszyfruj aktywny plik tekstowy do .dat
  context.subscriptions.push(
    vscode.commands.registerCommand('lf2dc.encryptCurrentToDat', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const textBytes = Buffer.from(editor.document.getText(), 'utf8');
      const encrypted = encryptBufferRaw(textBytes);

      const defaultUri = vscode.Uri.file(
        editor.document.uri.fsPath.replace(/\.txt$/i, '') +
          (editor.document.uri.fsPath.toLowerCase().endsWith('.dat') ? '' : '.dat')
      );

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'LF2 Data Files': ['dat'] }
      });
      if (!saveUri) return;

      await vscode.workspace.fs.writeFile(saveUri, encrypted);
      vscode.window.showInformationMessage(`Zapisano zaszyfrowany plik: ${path.basename(saveUri.fsPath)}`);
    })
  );

  // Komenda: utwórz nowy szablon AI.as (z LF2DCWindowsNoWTE/templates/AI.as)
  context.subscriptions.push(
    vscode.commands.registerCommand('lf2dc.createAiTemplate', async () => {
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
    })
  );
}

export function deactivate(): void {}