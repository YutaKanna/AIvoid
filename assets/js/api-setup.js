// API設定用のヘルパー関数

// Perspective APIキーを設定
function setupPerspectiveAPI() {
    const apiKey = prompt('Perspective API キーを入力してください:');
    if (apiKey) {
        localStorage.setItem('PERSPECTIVE_API_KEY', apiKey);
        alert('Perspective APIキーが設定されました');
        return true;
    }
    return false;
}

// 設定状態を確認
function checkAPISetup() {
    const youtubeKey = getYouTubeAPIKey();
    const perspectiveKey = localStorage.getItem('PERSPECTIVE_API_KEY');
    
    console.log('API設定状態:');
    console.log('YouTube API:', youtubeKey ? '設定済み' : '未設定');
    console.log('Perspective API:', perspectiveKey ? '設定済み' : '未設定');
    
    if (!youtubeKey) {
        console.log('YouTube APIキーを設定してください');
    }
    
    if (!perspectiveKey) {
        console.log('Perspective APIキーを設定してください');
        console.log('設定するには: setupPerspectiveAPI() を実行');
    }
    
    return {
        youtube: !!youtubeKey,
        perspective: !!perspectiveKey
    };
}

// APIキーをリセット
function resetAPIKeys() {
    if (confirm('すべてのAPIキーをリセットしますか？')) {
        localStorage.removeItem('YOUTUBE_API_KEY');
        localStorage.removeItem('PERSPECTIVE_API_KEY');
        alert('APIキーがリセットされました');
        location.reload();
    }
}

// グローバルに公開
window.setupPerspectiveAPI = setupPerspectiveAPI;
window.checkAPISetup = checkAPISetup;
window.resetAPIKeys = resetAPIKeys;