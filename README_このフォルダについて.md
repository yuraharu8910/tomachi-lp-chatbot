# このフォルダについて

元のGitHubリポジトリ([tomachi-lp](https://github.com/yuraharu8910/tomachi-lp))は一切変更していません。このフォルダは、そのLPを丸ごとコピーし、チャットボット(段階1)をあらかじめ組み込んだ**新しいプロジェクト**です。今回の課題はこちらで進めてください。

## 中身

| ファイル/フォルダ | 内容 |
|---|---|
| `index.html` | 元LPのHTML + チャットボットのHTMLを追記済み |
| `style.css` | 元LPのCSS(無変更) |
| `script.js` | 元LPのJS(無変更) |
| `chatbot.css` | 今回追加。チャットボットの見た目・開閉アニメーション |
| `chatbot.js` | 今回追加。開閉処理・吹き出し表示(回答ロジックは仮実装) |
| `images/` `videos/` `favicon.ico` | 元LPの素材(無変更) |

`index.html`にはすでに `chatbot.css` / `chatbot.js` の読み込みタグと、チャットボットのHTMLが追記済みです。**ダウンロードしてそのままVSCodeで開けば動きます**(貼り付け作業は不要です)。

## VSCodeでの開き方・動作確認

1. このフォルダをダウンロード・展開し、VSCodeで「フォルダを開く」からこのフォルダを選択する
2. 拡張機能「Live Server」をインストールしていない場合はインストールする
3. `index.html` を右クリック →「Open with Live Server」を選ぶ
4. ブラウザが自動で開くので、右下のチャットボタンをクリックして動作確認する

## 新しくGitHubリポジトリを作る場合(提出用)

元のリポジトリとは別の、この課題専用の新しいリポジトリを作ることをおすすめします。

1. GitHub上で新しいリポジトリを作成する(例: `tomachi-lp-chatbot`。「Add a README file」はチェックしなくてOK)
2. VSCodeでこのフォルダを開いた状態でターミナルを開き(メニュー「ターミナル」→「新しいターミナル」)、以下を順番に実行する

   ```
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin (作成したリポジトリのURL)
   git push -u origin main
   ```

## 次のステップ

段階2(Google Sheets連携)に進みます。`chatbot.js` 内の

```js
// TODO(段階2): ここでGoogle Sheetsのキーワード一致処理を呼ぶ
```

の部分を実装していきます。
