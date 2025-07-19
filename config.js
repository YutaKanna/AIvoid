// 設定ファイル
const CONFIG = {
    YOUTUBE_API_KEY: '', // サーバーから取得
    PERSPECTIVE_API_KEY: '', // サーバーから取得
    YOUTUBE_API_BASE_URL: window.location.hostname === 'localhost' 
        ? '/api/youtube' // ローカル開発時はプロキシ経由
        : 'https://www.googleapis.com/youtube/v3', // 本番環境
    // チャンネルID
    DEFAULT_CHANNEL_ID: 'UC1H5dv45x2aFKk-6JZLSWIQ',
    IS_LOCAL: window.location.hostname === 'localhost'
};

// APIキーを設定する関数
function setYouTubeAPIKey(apiKey) {
    CONFIG.YOUTUBE_API_KEY = apiKey;
}

function setPerspectiveAPIKey(apiKey) {
    CONFIG.PERSPECTIVE_API_KEY = apiKey;
}

// APIキーを取得する関数
function getYouTubeAPIKey() {
    return CONFIG.YOUTUBE_API_KEY;
}

function getPerspectiveAPIKey() {
    return CONFIG.PERSPECTIVE_API_KEY;
}

// サーバーからAPIキーを取得
async function loadConfig() {
    if (CONFIG.IS_LOCAL) {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            setYouTubeAPIKey(data.YOUTUBE_API_KEY);
            if (data.PERSPECTIVE_API_KEY) {
                setPerspectiveAPIKey(data.PERSPECTIVE_API_KEY);
            }
            return true;
        } catch (error) {
            console.error('Failed to load config from server:', error);
            return false;
        }
    } else {
        // 本番環境では別の方法でAPIキーを設定
        const youtubeKey = localStorage.getItem('YOUTUBE_API_KEY');
        const perspectiveKey = localStorage.getItem('PERSPECTIVE_API_KEY');
        
        if (youtubeKey) {
            setYouTubeAPIKey(youtubeKey);
        }
        if (perspectiveKey) {
            setPerspectiveAPIKey(perspectiveKey);
        }
        
        return !!youtubeKey;
    }
}