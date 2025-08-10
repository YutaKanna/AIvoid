// 設定ファイル
const CONFIG = {
    // チャンネルID
    DEFAULT_CHANNEL_ID: 'UC1H5dv45x2aFKk-6JZLSWIQ'
};

// サーバーサイドプロキシを使用するため、クライアント側でAPIキーの管理は不要
async function loadConfig() {
    // APIキーはサーバー側で管理されるため、クライアントは何もしない
    return true;
}