document.addEventListener('DOMContentLoaded', function() {
    // グローバル変数
    let currentVideoId = null;
    let nextPageToken = null;
    let isLoading = false;
    let currentTab = 'filtered'; // 'filtered' or 'toxic'
    let allComments = [];
    let filteredData = { safe: [], toxic: [], analysis: {} };
    
    // 初期化
    initialize();
    
    async function initialize() {
        // 設定を読み込む
        try {
            await loadConfig();
            // console.log('Config loaded successfully');
        } catch (error) {
            // console.error('Failed to load config:', error);
        }
        
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
            // console.log('Loading video details for ID:', currentVideoId);
            const videoDetails = await youtubeAPI.getVideoDetails(currentVideoId);
            
            // 動画情報を表示
            const titleElement = document.querySelector('.video-meta h2');
            const viewCountElement = document.querySelector('.video-meta p');
            
            if (titleElement && videoDetails.title) {
                titleElement.textContent = videoDetails.title;
            }
            
            if (viewCountElement && videoDetails.viewCount && videoDetails.publishedAt) {
                viewCountElement.textContent = 
                    `${videoDetails.viewCount}回視聴 ${videoDetails.publishedAt}`;
            }
            
            // サムネイルを更新
            const thumbnailContainer = document.querySelector('.video-thumbnail-placeholder');
            if (thumbnailContainer && videoDetails.thumbnail) {
                // 背景色を設定してからサムネイルを表示
                thumbnailContainer.style.backgroundColor = '#000';
                thumbnailContainer.innerHTML = `
                    <img src="${videoDetails.thumbnail}" alt="${videoDetails.title || ''}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">
                `;
            }
            
        } catch (error) {
            console.error('Failed to load video details:', error);
            
            // エラー時の表示
            const titleElement = document.querySelector('.video-meta h2');
            const viewCountElement = document.querySelector('.video-meta p');
            
            if (titleElement) {
                titleElement.textContent = '動画情報を取得できませんでした';
            }
            
            if (viewCountElement) {
                viewCountElement.textContent = 'エラーが発生しました';
            }
        }
    }
    
    // コメントを読み込む
    async function loadComments(append = false, quickLoad = false) {
        if (isLoading) return;
        
        isLoading = true;
        
        // 初回読み込み時はクイックロードを有効化
        if (!append && !quickLoad) {
            quickLoad = true;
        }
        
        if (!quickLoad || append) {
            showLoadingIndicator();
        }
        
        try {
            // YouTube APIでコメントを取得（5件取得 - API制限を考慮）
            const result = await youtubeAPI.getVideoComments(
                currentVideoId, 
                append ? nextPageToken : null, 
                5  // 5件取得
            );
            
            nextPageToken = result.nextPageToken;
            
            // コメントデータを保存（重複を除外）
            if (!append) {
                allComments = result.comments;
            } else {
                // 既存のコメントIDのセットを作成
                const existingIds = new Set(allComments.map(c => c.id));
                // 新しいコメントのみを追加
                const newComments = result.comments.filter(c => !existingIds.has(c.id));
                allComments = allComments.concat(newComments);
                // console.log(`Added ${newComments.length} new comments, skipped ${result.comments.length - newComments.length} duplicates`);
            }
            
            // 全コメントを分析対象とする
            let commentsToAnalyze = !append ? result.comments : 
                result.comments.filter(c => !allComments.slice(0, -result.comments.length).some(existing => existing.id === c.id));
            
            const filteredComments = await filterComments(commentsToAnalyze);
            
            // フィルター結果を保存
            if (!append) {
                filteredData = filteredComments;
            } else {
                // 重複チェックしながら追加
                const existingSafeIds = new Set(filteredData.safe.map(c => c.id));
                const existingToxicIds = new Set(filteredData.toxic.map(c => c.id));
                
                filteredData.safe = filteredData.safe.concat(
                    filteredComments.safe.filter(c => !existingSafeIds.has(c.id))
                );
                filteredData.toxic = filteredData.toxic.concat(
                    filteredComments.toxic.filter(c => !existingToxicIds.has(c.id))
                );
                Object.assign(filteredData.analysis, filteredComments.analysis);
            }
            
            // コメントを表示
            if (currentTab === 'filtered') {
                displayFilteredComments(filteredData.safe, append);
            }
            
            
        } catch (error) {
            console.error('Failed to load comments:', error);
            showError('コメントの読み込みに失敗しました');
        } finally {
            isLoading = false;
            if (!quickLoad || append) {
                hideLoadingIndicator();
            }
        }
    }
    
    
    // コメントをフィルタリング
    async function filterComments(comments) {
        // サーバー側のプロキシAPIを使用するため、キーチェックは不要
        // console.log('Using Perspective API for comment filtering via server proxy');
        
        const safe = [];
        const toxic = [];
        const analysis = {};
        
        // バッチ処理でコメントを分析
        for (const comment of comments) {
            try {
                // console.log(`Analyzing comment: "${comment.textOriginal}"`);
                const result = await perspectiveAPI.analyzeComment(comment.textOriginal);
                analysis[comment.id] = result;
                
                // 各コメントのスコアを詳細表示
                // console.log(`Comment analysis result:`, {
                //     text: comment.textOriginal,
                //     isToxic: result.isToxic,
                //     scores: {
                //         TOXICITY: result.scores.TOXICITY || 0,
                //         INSULT: result.scores.INSULT || 0,
                //         THREAT: result.scores.THREAT || 0,
                //         IDENTITY_ATTACK: result.scores.IDENTITY_ATTACK || 0
                //     },
                //     isJapanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(comment.textOriginal)
                // });
                
                if (!result.isToxic) {
                    safe.push(comment);
                } else {
                    toxic.push(comment);
                    // console.log(`Toxic comment found: "${comment.textOriginal}"`);
                }
            } catch (error) {
                // console.error(`Error analyzing comment "${comment.textOriginal}":`, error);
                // APIキーエラーの場合は特別な処理
                if (error.message && error.message.includes('API key not valid')) {
                    console.warn('Perspective API key is invalid. Treating all comments as safe.');
                    // 残りのコメントも全て安全として扱う
                    safe.push(comment);
                    analysis[comment.id] = { isToxic: false, scores: {}, error: 'Invalid API key' };
                } else {
                    // その他のエラーの場合は安全として扱う
                    safe.push(comment);
                    analysis[comment.id] = { isToxic: false, scores: {}, error: error.message };
                }
            }
        }
        
        // console.log(`Filtering complete: ${safe.length} safe, ${toxic.length} toxic out of ${comments.length} total comments`);
        
        return { safe, toxic, analysis };
    }
    
    // フィルタリングされたコメントを表示
    function displayFilteredComments(comments, append = false) {
        const container = document.getElementById('person-comments');
        
        if (!append) {
            container.innerHTML = '';
        }
        
        // 既存のコメントIDを取得
        const existingCommentIds = new Set(
            Array.from(container.querySelectorAll('.comment-item'))
                .map(el => el.dataset.commentId)
                .filter(id => id)
        );
        
        comments.forEach(comment => {
            if (!existingCommentIds.has(comment.id)) {
                const commentElement = createCommentElement(comment);
                commentElement.dataset.commentId = comment.id;
                container.appendChild(commentElement);
            }
        });
        
        if (comments.length === 0 && !append) {
            container.innerHTML = '<p class="no-comments">表示できるコメントがありません</p>';
        }
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
                </div>
                <p class="comment-text">${comment.text}</p>
                <div class="comment-actions">
                    <button class="comment-action-btn">
                        👍 ${comment.likeCount > 0 ? comment.likeCount : ''}
                    </button>
                    <button class="comment-action-btn">
                        👎
                    </button>
                    <button class="comment-action-btn">
                        返信
                    </button>
                </div>
                ${analysisResult && currentTab === 'all' ? createScoreBadges(analysisResult.scores) : ''}
                ${comment.replyCount > 0 ? `<button class="show-replies-btn" data-comment-id="${comment.id}">▼ ${comment.replyCount} 件の返信</button>` : ''}
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
        const showRepliesBtn = commentElement.querySelector('.show-replies-btn');
        
        if (existingReplies) {
            existingReplies.remove();
            showRepliesBtn.innerHTML = `▼ ${comment.replyCount} 件の返信`;
        } else {
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies-container';
            
            comment.replies.forEach(reply => {
                const replyElement = createReplyElement(reply);
                repliesContainer.appendChild(replyElement);
            });
            
            // コメントの最後の要素の後に挿入
            const commentContent = commentElement.querySelector('.comment-content');
            commentContent.appendChild(repliesContainer);
            showRepliesBtn.innerHTML = `▲ ${comment.replyCount} 件の返信`;
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
                <div class="comment-actions">
                    <button class="comment-action-btn">
                        👍 ${reply.likeCount > 0 ? reply.likeCount : ''}
                    </button>
                    <button class="comment-action-btn">
                        👎
                    </button>
                    <button class="comment-action-btn">
                        返信
                    </button>
                </div>
            </div>
        `;
        
        return div;
    }
    
    // イベントリスナーを設定
    function setupEventListeners() {
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
        const container = document.getElementById('person-comments');
        
        // 既にコンテンツがある場合は下部に小さく表示
        if (container.children.length > 0) {
            const loader = document.createElement('div');
            loader.className = 'comment-loader comment-loader-small';
            loader.innerHTML = '<div style="width: 24px; height: 24px; border: 2px solid #f3f3f3; border-top-color: #4A90E2; border-radius: 50%; animation: spin 0.6s linear infinite; margin: 0 auto;"></div>';
            container.appendChild(loader);
        } else {
            const loader = document.createElement('div');
            loader.className = 'comment-loader';
            loader.innerHTML = `
                <div style="width: 32px; height: 32px; border: 2px solid #f3f3f3; border-top-color: #4A90E2; border-radius: 50%; animation: spin 0.6s linear infinite; margin: 0 auto 16px auto;"></div>
                <p>コメントを読み込んでいます...</p>
            `;
            container.appendChild(loader);
        }
    }
    
    // ローディング非表示
    function hideLoadingIndicator() {
        const loaders = document.querySelectorAll('.comment-loader');
        loaders.forEach(loader => loader.remove());
    }
    
    // エラー表示
    function showError(message) {
        const container = document.getElementById('person-comments');
            
        const error = document.createElement('div');
        error.className = 'error-message';
        error.textContent = message;
        container.appendChild(error);
    }
    
});