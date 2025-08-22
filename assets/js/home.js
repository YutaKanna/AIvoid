// ホーム画面専用のJavaScript
let nextPageToken = null;
let isLoading = false;
let allVideos = [];

document.addEventListener('DOMContentLoaded', function() {
    // APIキーの設定チェックと初期化
    initializeYouTubeData();
    
    // 家アイコンのクリック処理
    const homeButton = document.getElementById('homeButton');
    if (homeButton) {
        homeButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // スクロールをトップに戻す
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            
            // 最新動画を再取得
            refreshHomeContent();
        });
    }
    
    // Coming Soonリンクの処理
    const comingSoonLinks = document.querySelectorAll('.coming-soon');
    const modal = document.getElementById('coming-soon-modal');
    const featureText = document.getElementById('coming-soon-feature');
    const closeBtn = document.querySelector('.coming-soon-close');
    
    comingSoonLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const feature = this.getAttribute('data-feature');
            featureText.textContent = `「${feature}」機能は`;
            modal.style.display = 'flex';
        });
    });
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    // モーダル外側クリックで閉じる
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // 無限スクロールの実装
    window.addEventListener('scroll', async function() {
        if (isLoading) return;
        
        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.offsetHeight;
        
        // ページ下部に近づいたら追加読み込み
        if (scrollPosition >= documentHeight - 500 && nextPageToken) {
            await loadMoreVideos();
        }
    });
});

async function initializeYouTubeData() {
    try {
        // 設定を読み込む
        const configLoaded = await loadConfig();
        
        if (!configLoaded) {
            console.error('APIキーの設定を読み込めませんでした');
            return;
        }

        // URLパラメータからチャンネルIDを取得
        const urlParams = new URLSearchParams(window.location.search);
        const channelIdFromUrl = urlParams.get('channel');
        
        // チャンネルIDを設定（URLパラメータ優先、なければデフォルト）
        if (channelIdFromUrl) {
            CONFIG.DEFAULT_CHANNEL_ID = channelIdFromUrl;
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
        // 現在のチャンネルIDを取得（getChannelInfoで保存されたID）
        const channelId = youtubeAPI.currentChannelId || CONFIG.DEFAULT_CHANNEL_ID;
        const result = await youtubeAPI.getChannelVideos(channelId, 10);
        
        // グローバル変数を更新
        allVideos = result.videos;
        nextPageToken = result.nextPageToken;
        
        // 動画リストを更新
        const videoList = document.querySelector('.video-list');
        if (videoList && allVideos.length > 0) {
            videoList.innerHTML = allVideos.map((video) => `
                <div class="video-item" data-video-id="${video.id}">
                    <img src="${video.thumbnail}" alt="${video.title}" class="thumbnail">
                    <div class="video-info">
                        <h4>${truncateTitle(video.title)}</h4>
                        <p>${video.viewCount}回視聴 ${video.publishedAt}</p>
                    </div>
                </div>
            `).join('');

            // 動画アイテムのクリックイベントを再設定
            setupVideoClickEvents();
        }

        console.log('Videos loaded:', allVideos);
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

// コンテンツをリフレッシュする関数
async function refreshHomeContent() {
    try {
        // ページネーションをリセット
        nextPageToken = null;
        allVideos = [];
        
        // ローディング表示
        showLoading();
        
        // チャンネル情報を再取得
        await loadChannelInfo();
        
        // 動画一覧を再取得
        await loadChannelVideos();
        
        // ローディング非表示
        hideLoading();
        
        console.log('Home content refreshed');
    } catch (error) {
        console.error('Failed to refresh content:', error);
        hideLoading();
    }
}

// 追加の動画を読み込む関数
async function loadMoreVideos() {
    if (isLoading || !nextPageToken) return;
    
    try {
        isLoading = true;
        
        // ローディングインジケータを表示
        const videoList = document.querySelector('.video-list');
        if (videoList) {
            videoList.insertAdjacentHTML('beforeend', '<div class="loading-more"><div class="spinner"></div></div>');
        }
        
        const channelId = youtubeAPI.currentChannelId || CONFIG.DEFAULT_CHANNEL_ID;
        const result = await youtubeAPI.getChannelVideos(channelId, 10, nextPageToken);
        
        // 新しい動画を追加
        allVideos = [...allVideos, ...result.videos];
        nextPageToken = result.nextPageToken;
        
        // ローディングインジケータを削除
        const loadingIndicator = document.querySelector('.loading-more');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // 新しい動画をDOMに追加
        if (videoList && result.videos.length > 0) {
            const newVideosHtml = result.videos.map((video) => `
                <div class="video-item" data-video-id="${video.id}">
                    <img src="${video.thumbnail}" alt="${video.title}" class="thumbnail">
                    <div class="video-info">
                        <h4>${truncateTitle(video.title)}</h4>
                        <p>${video.viewCount}回視聴 ${video.publishedAt}</p>
                    </div>
                </div>
            `).join('');
            
            videoList.insertAdjacentHTML('beforeend', newVideosHtml);
            
            // 動画アイテムのクリックイベントを再設定
            setupVideoClickEvents();
        }
        
        console.log('More videos loaded:', result.videos.length);
    } catch (error) {
        console.error('Failed to load more videos:', error);
        // ローディングインジケータを削除
        const loadingIndicator = document.querySelector('.loading-more');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    } finally {
        isLoading = false;
    }
}

// グローバルに公開（デバッグ用）
window.resetAPIKey = resetAPIKey;
window.loadChannelInfo = loadChannelInfo;