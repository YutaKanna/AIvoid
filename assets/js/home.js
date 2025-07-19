// ホーム画面専用のJavaScript
document.addEventListener('DOMContentLoaded', function() {
    // APIキーの設定チェックと初期化
    initializeYouTubeData();
});

async function initializeYouTubeData() {
    try {
        // 設定を読み込む
        const configLoaded = await loadConfig();
        
        if (!configLoaded) {
            // ローカル環境でない場合、APIキーの入力を求める
            if (!CONFIG.IS_LOCAL) {
                const apiKey = prompt('YouTube Data API キーを入力してください:');
                if (apiKey) {
                    setYouTubeAPIKey(apiKey);
                    localStorage.setItem('YOUTUBE_API_KEY', apiKey);
                } else {
                    console.log('APIキーが設定されていません。デモデータを表示します。');
                    return;
                }
            } else {
                console.error('サーバーからの設定読み込みに失敗しました');
                return;
            }
        }

        // ローディング表示
        showLoading();

        // チャンネル情報を取得
        await loadChannelInfo();
        
        // 動画一覧を取得
        await loadChannelVideos();

        // ローディング非表示
        hideLoading();

    } catch (error) {
        console.error('YouTube API Error:', error);
        hideLoading();
        
        // エラーの場合はデフォルトデータを表示
        if (error.message.includes('API key')) {
            alert('APIキーが無効です。設定を確認してください。');
        } else {
            alert('データの取得に失敗しました。デモデータを表示します。');
        }
    }
}

async function loadChannelInfo() {
    try {
        const channelInfo = await youtubeAPI.getChannelInfo();
        
        // ユーザー情報を更新
        const userDetails = document.querySelector('.user-details');
        if (userDetails) {
            userDetails.innerHTML = `
                <h3>${channelInfo.title} ${channelInfo.customUrl ? '@' + channelInfo.customUrl.replace('@', '') : ''}</h3>
                <p>登録者数 ${channelInfo.subscriberCount}人 ${channelInfo.videoCount}本の動画</p>
            `;
        }

        // チャンネルアバター画像を更新
        const userAvatarContainer = document.querySelector('.user-avatar-container');
        if (userAvatarContainer && channelInfo.thumbnail) {
            userAvatarContainer.innerHTML = `
                <img src="${channelInfo.thumbnail}" alt="${channelInfo.title}" class="user-avatar-img">
            `;
        }

        console.log('Channel info loaded:', channelInfo);
    } catch (error) {
        console.error('Failed to load channel info:', error);
    }
}

async function loadChannelVideos() {
    try {
        const videos = await youtubeAPI.getChannelVideos(CONFIG.DEFAULT_CHANNEL_ID, 4);
        
        // 動画リストを更新
        const videoList = document.querySelector('.video-list');
        if (videoList && videos.length > 0) {
            videoList.innerHTML = videos.map((video) => `
                <div class="video-item" data-video-id="${video.id}">
                    <img src="${video.thumbnail}" alt="${video.title}" class="thumbnail">
                    <div class="video-info">
                        <h4>${truncateTitle(video.title)}</h4>
                        <p>${video.viewCount}回視聴 ${video.publishedAt}</p>
                        <button class="btn-secondary">本人返信あり</button>
                    </div>
                    <span class="video-badge">${Math.floor(Math.random() * 5) + 1}</span>
                </div>
            `).join('');

            // 動画アイテムのクリックイベントを再設定
            setupVideoClickEvents();
        }

        console.log('Videos loaded:', videos);
    } catch (error) {
        console.error('Failed to load videos:', error);
    }
}

function getVideoIcon(index) {
    const icons = ['🌅', '🛒', '💄', '🎄', '🎵', '🎮', '🍳', '✈️'];
    return icons[index % icons.length];
}

function truncateTitle(title, maxLength = 15) {
    if (title.length > maxLength) {
        return title.substring(0, maxLength) + '...';
    }
    return title;
}

function setupVideoClickEvents() {
    const videoItems = document.querySelectorAll('.video-item');
    videoItems.forEach(item => {
        item.addEventListener('click', function() {
            const videoId = this.getAttribute('data-video-id');
            if (videoId) {
                // 実際の動画IDをlocalStorageに保存
                localStorage.setItem('selectedVideoId', videoId);
            }
            window.location.href = 'video-detail.html';
        });
    });
}

function showLoading() {
    // チャンネル情報のローディング表示
    const userDetails = document.querySelector('.user-details');
    if (userDetails) {
        userDetails.innerHTML = '<div class="loading-text">チャンネル情報を読み込んでいます...</div>';
    }
    
    // アバターのローディング表示
    const userAvatarContainer = document.querySelector('.user-avatar-container');
    if (userAvatarContainer) {
        userAvatarContainer.innerHTML = '<div class="avatar-loading"></div>';
    }
}

function hideLoading() {
    // ローディング非表示は各データ読み込み完了時に行われる
}

// APIキーをリセットする関数（デバッグ用）
function resetAPIKey() {
    localStorage.removeItem('YOUTUBE_API_KEY');
    location.reload();
}

// グローバルに公開（デバッグ用）
window.resetAPIKey = resetAPIKey;
window.loadChannelInfo = loadChannelInfo;