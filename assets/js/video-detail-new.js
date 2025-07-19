document.addEventListener('DOMContentLoaded', function() {
    // グローバル変数
    let currentVideoId = null;
    let nextPageToken = null;
    let isLoading = false;
    let currentTab = 'filtered'; // 'filtered' or 'all'
    
    // 初期化
    initialize();
    
    async function initialize() {
        // URLパラメータまたはlocalStorageから動画IDを取得
        const urlParams = new URLSearchParams(window.location.search);
        currentVideoId = urlParams.get('v') || localStorage.getItem('selectedVideoId');
        
        if (!currentVideoId) {
            console.error('No video ID found');
            return;
        }
        
        // 動画情報を読み込む
        await loadVideoDetails();
        
        // コメントを読み込む
        await loadComments();
        
        // イベントリスナーを設定
        setupEventListeners();
        
        // 無限スクロールを設定
        setupInfiniteScroll();
    }
    
    // 動画詳細情報を読み込む
    async function loadVideoDetails() {
        try {
            const videoDetails = await youtubeAPI.getVideoDetails(currentVideoId);
            
            // 動画情報を表示
            document.querySelector('.video-meta h2').textContent = videoDetails.title;
            document.querySelector('.video-meta p').textContent = 
                `${videoDetails.viewCount}回視聴 ${videoDetails.publishedAt}`;
            
            // サムネイルを更新
            const thumbnailContainer = document.querySelector('.video-thumbnail-placeholder');
            thumbnailContainer.innerHTML = `
                <img src="${videoDetails.thumbnail}" alt="${videoDetails.title}" style="width: 100%; height: 100%; object-fit: cover;">
            `;
            
        } catch (error) {
            console.error('Failed to load video details:', error);
        }
    }
    
    // コメントを読み込む
    async function loadComments(append = false) {
        if (isLoading) return;
        
        isLoading = true;
        showLoadingIndicator();
        
        try {
            // YouTube APIでコメントを取得
            const result = await youtubeAPI.getVideoComments(
                currentVideoId, 
                append ? nextPageToken : null, 
                20
            );
            
            nextPageToken = result.nextPageToken;
            
            // Perspective APIでフィルタリング
            const filteredComments = await filterComments(result.comments);
            
            // コメントを表示
            if (currentTab === 'filtered') {
                displayFilteredComments(filteredComments.safe, append);
            } else {
                displayAllComments(result.comments, filteredComments.analysis, append);
            }
            
        } catch (error) {
            console.error('Failed to load comments:', error);
            showError('コメントの読み込みに失敗しました');
        } finally {
            isLoading = false;
            hideLoadingIndicator();
        }
    }
    
    // コメントをフィルタリング
    async function filterComments(comments) {
        const perspectiveKey = localStorage.getItem('PERSPECTIVE_API_KEY');
        
        if (!perspectiveKey) {
            // Perspective APIキーがない場合は全て安全と判定
            return {
                safe: comments,
                toxic: [],
                analysis: {}
            };
        }
        
        perspectiveAPI.setAPIKey(perspectiveKey);
        
        const safe = [];
        const toxic = [];
        const analysis = {};
        
        // バッチ処理でコメントを分析
        for (const comment of comments) {
            const result = await perspectiveAPI.analyzeComment(comment.textOriginal);
            analysis[comment.id] = result;
            
            if (!result.isToxic) {
                safe.push(comment);
            } else {
                toxic.push(comment);
            }
        }
        
        return { safe, toxic, analysis };
    }
    
    // フィルタリングされたコメントを表示
    function displayFilteredComments(comments, append = false) {
        const container = document.getElementById('person-comments');
        
        if (!append) {
            container.innerHTML = '';
        }
        
        comments.forEach(comment => {
            const commentElement = createCommentElement(comment);
            container.appendChild(commentElement);
        });
        
        if (comments.length === 0 && !append) {
            container.innerHTML = '<p class="no-comments">表示できるコメントがありません</p>';
        }
    }
    
    // 全コメントを表示（毒性スコア付き）
    function displayAllComments(comments, analysis, append = false) {
        const container = document.getElementById('ai-comments');
        
        if (!append) {
            container.innerHTML = '';
        }
        
        comments.forEach(comment => {
            const commentElement = createCommentElement(comment, analysis[comment.id]);
            container.appendChild(commentElement);
        });
    }
    
    // コメント要素を作成
    function createCommentElement(comment, analysisResult = null) {
        const div = document.createElement('div');
        div.className = 'comment-item';
        
        const isToxic = analysisResult && analysisResult.isToxic;
        if (isToxic) {
            div.classList.add('toxic-comment');
        }
        
        div.innerHTML = `
            <img src="${comment.authorProfileImageUrl}" alt="${comment.authorName}" class="comment-avatar">
            <div class="comment-content">
                <div class="comment-meta">
                    <span class="comment-author">${comment.authorName}</span>
                    <span class="comment-time">${comment.publishedAt}</span>
                    ${comment.likeCount > 0 ? `<span class="comment-likes">👍 ${comment.likeCount}</span>` : ''}
                </div>
                <p class="comment-text">${comment.text}</p>
                ${analysisResult && currentTab === 'all' ? createScoreBadges(analysisResult.scores) : ''}
                ${comment.replyCount > 0 ? `<button class="show-replies-btn" data-comment-id="${comment.id}">返信を表示 (${comment.replyCount}件)</button>` : ''}
            </div>
        `;
        
        // 返信を表示するボタンのイベントリスナー
        const showRepliesBtn = div.querySelector('.show-replies-btn');
        if (showRepliesBtn) {
            showRepliesBtn.addEventListener('click', () => toggleReplies(comment, div));
        }
        
        return div;
    }
    
    // 毒性スコアバッジを作成
    function createScoreBadges(scores) {
        const badges = [];
        
        for (const [attribute, score] of Object.entries(scores)) {
            if (score > 0.5) {
                const color = score > 0.7 ? 'red' : 'orange';
                badges.push(`<span class="score-badge" style="background-color: ${color};">${attribute}: ${Math.round(score * 100)}%</span>`);
            }
        }
        
        return badges.length > 0 ? `<div class="score-badges">${badges.join(' ')}</div>` : '';
    }
    
    // 返信の表示/非表示を切り替え
    function toggleReplies(comment, commentElement) {
        const existingReplies = commentElement.querySelector('.replies-container');
        
        if (existingReplies) {
            existingReplies.remove();
        } else {
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies-container';
            
            comment.replies.forEach(reply => {
                const replyElement = createReplyElement(reply);
                repliesContainer.appendChild(replyElement);
            });
            
            commentElement.appendChild(repliesContainer);
        }
    }
    
    // 返信要素を作成
    function createReplyElement(reply) {
        const div = document.createElement('div');
        div.className = 'reply-item';
        
        div.innerHTML = `
            <img src="${reply.authorProfileImageUrl}" alt="${reply.authorName}" class="reply-avatar">
            <div class="reply-content">
                <div class="reply-meta">
                    <span class="reply-author">${reply.authorName}</span>
                    <span class="reply-time">${reply.publishedAt}</span>
                </div>
                <p class="reply-text">${reply.text}</p>
            </div>
        `;
        
        return div;
    }
    
    // イベントリスナーを設定
    function setupEventListeners() {
        // タブ切り替え
        const personTab = document.getElementById('person-tab');
        const aiTab = document.getElementById('ai-tab');
        
        personTab.addEventListener('click', () => {
            currentTab = 'filtered';
            personTab.classList.add('active');
            aiTab.classList.remove('active');
            document.getElementById('person-comments').classList.add('active');
            document.getElementById('ai-comments').classList.remove('active');
            
            // タブ名を更新
            personTab.textContent = 'AIフィルター済み';
            
            // コメントを再読み込み
            nextPageToken = null;
            loadComments();
        });
        
        aiTab.addEventListener('click', () => {
            currentTab = 'all';
            aiTab.classList.add('active');
            personTab.classList.remove('active');
            document.getElementById('ai-comments').classList.add('active');
            document.getElementById('person-comments').classList.remove('active');
            
            // タブ名を更新
            aiTab.textContent = '全てのコメント';
            
            // コメントを再読み込み
            nextPageToken = null;
            loadComments();
        });
        
        // 初期タブ名を設定
        personTab.textContent = 'AIフィルター済み';
        aiTab.textContent = '全てのコメント';
    }
    
    // 無限スクロールを設定
    function setupInfiniteScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !isLoading && nextPageToken) {
                    loadComments(true);
                }
            });
        }, {
            rootMargin: '100px'
        });
        
        // スクロール監視用の要素を追加
        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '1px';
        document.querySelector('.comments-container').appendChild(sentinel);
        
        observer.observe(sentinel);
    }
    
    // ローディング表示
    function showLoadingIndicator() {
        const container = currentTab === 'filtered' ? 
            document.getElementById('person-comments') : 
            document.getElementById('ai-comments');
            
        const loader = document.createElement('div');
        loader.className = 'comment-loader';
        loader.innerHTML = '<div class="loader-spinner"></div><p>コメントを読み込んでいます...</p>';
        container.appendChild(loader);
    }
    
    // ローディング非表示
    function hideLoadingIndicator() {
        const loaders = document.querySelectorAll('.comment-loader');
        loaders.forEach(loader => loader.remove());
    }
    
    // エラー表示
    function showError(message) {
        const container = currentTab === 'filtered' ? 
            document.getElementById('person-comments') : 
            document.getElementById('ai-comments');
            
        const error = document.createElement('div');
        error.className = 'error-message';
        error.textContent = message;
        container.appendChild(error);
    }
});