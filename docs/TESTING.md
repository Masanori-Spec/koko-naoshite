# ここ直して 検証記録

検証日：2026-10-05。ソースは本配布物に同梱。

## 結果

- Node.js v22.16.0の `node:test`：29件成功、0件失敗。
- ChromiumのDOM操作テスト：20件成功、0件失敗。
- 320 / 375 / 768 / 1440px：計4条件で横はみ出しなし、JavaScript実行エラーなし。
- 入力されたHTML風の文字列がHTMLとして実行されないことを確認。

## テスト方法と限界

ブラウザ側はPlaywrightから `about:blank` にDOM・ローカルのCSS・JavaScriptを配置して検査しています。ハーネスはブラウザのネットワーク制限を変更せず、アプリのソースも変更しません。ただしこの方法は、通常のURLナビゲーション・静的配信・CSPの読み込み経路を検証するものではありません。

Web Storageは明示的なメモリー上の代替実装を使い、保存状態を次のページに渡して復元を検査しています。実ブラウザの保存上限や再起動後の保存は未検証です。保存容量不足・別タブ変更はイベントや例外を模擬して検査しています。

書き出しはBlobの内容を検査し、JSON・Markdownの内容とPNGのシグネチャを確認しています。ブラウザの実ダウンロードUI、OSのファイル保存、クリップボードの許可ダイアログは未検証です。

画面幅の検証はChromiumのビューポート変更です。実機iPhone/Safari/WebKit・Android・全ブラウザの互換性検証ではありません。表示差や未発見の不具合はあり得ます。

## DOMテストを再実行

PlaywrightのPythonパッケージとChromiumが利用できる開発環境で、次を実行します。これらはアプリの利用には必要ありません。ブラウザ実行ファイルを指定する場合は環境変数 `QUIET_CHROMIUM` を使います。

```sh
python tests/browser_test.py
```

結果は `tests/integration-results.json` に生成されます。外部サービスのAPIには接続しません。

## 確認した操作

- PASS: sample detects changes in protected region
- PASS: clock exclusion is counted
- PASS: canvas has actual rendered pixels
- PASS: project export includes images and three regions
- PASS: instruction edit clears verification
- PASS: threshold edit invalidates diff and verification
- PASS: keyboard coordinate form adds rectangle
- PASS: region title is not interpreted as HTML
- PASS: region deletion works
- PASS: undo restores removed region
- PASS: pointer drag creates rectangle
- PASS: annotated PNG is valid PNG bytes
- PASS: instruction file includes protected and fix intent
- PASS: saved project restores images and regions
- PASS: imported verification starts unchecked
- PASS: external URL import rejected without losing current state
- PASS: different image dimensions prevent false comparison
- PASS: SVG upload is rejected
- PASS: clear removes images and regions
- PASS: no JavaScript errors
