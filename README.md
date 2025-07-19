# AIvoid

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、APIキーを設定：

```
YOUTUBE_API_KEY=your_api_key_here
PERSPECTIVE_API_KEY=your_api_key_here
```

### 3. 開発サーバーの起動

```bash
npm start
```

ブラウザで `http://localhost:3000/index.html` にアクセス
2025/07/19時点でログイン画面は未開発のため、id, password入力なしでボタン押せば遷移します

## 機能

- YouTubeチャンネル情報の取得
- 動画一覧の表示
- コメント管理（AI自動返信・本人返信）
- アナリティクス表示
- 通知管理
