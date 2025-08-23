document.addEventListener('DOMContentLoaded', function() {
    // グローバル変数
    let currentVideoId = null;
    let nextPageToken = null;
    let isLoading = false;
    let currentTab = 'filtered'; // 'filtered' or 'toxic'
    let allComments = [];
    let filteredData = { safe: [], toxic: [], analysis: {} };
    let isProcessingBackground = false;
    let pendingComments = [];
    
    // 初期化
    initialize();
    
    async function initialize() {
        // 設定を読み込む
        try {
            await loadConfig();
            console.log('Config loaded successfully');
        } catch (error) {
            console.error('Failed to load config:', error);
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
            console.log('Loading video details for ID:', currentVideoId);
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
            // YouTube APIでコメントを取得（テスト用：1件のみ）
            const result = await youtubeAPI.getVideoComments(
                currentVideoId, 
                append ? nextPageToken : null, 
                1  // 1件のみ取得
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
                console.log(`Added ${newComments.length} new comments, skipped ${result.comments.length - newComments.length} duplicates`);
            }
            
            // クイックロード時は最初の5件のみ処理
            let commentsToAnalyze = !append ? result.comments : 
                result.comments.filter(c => !allComments.slice(0, -result.comments.length).some(existing => existing.id === c.id));
            
            // クイックロード処理を無効化（1件のみなので不要）
            pendingComments = [];
            
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
            } else if (currentTab === 'toxic') {
                displayToxicComments(filteredData.toxic, filteredData.analysis, append);
            }
            
            // バックグラウンド処理を開始
            if (quickLoad && pendingComments.length > 0 && !isProcessingBackground) {
                setTimeout(() => processBackgroundComments(), 100);
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
    
    // バックグラウンドでコメントを処理
    async function processBackgroundComments() {
        if (isProcessingBackground || pendingComments.length === 0) return;
        
        isProcessingBackground = true;
        console.log(`Processing ${pendingComments.length} pending comments in background`);
        
        try {
            // バッチ処理（3件ずつ）
            while (pendingComments.length > 0) {
                const batch = pendingComments.splice(0, 3);
                const filteredBatch = await filterComments(batch);
                
                // フィルター結果を追加
                const existingSafeIds = new Set(filteredData.safe.map(c => c.id));
                const existingToxicIds = new Set(filteredData.toxic.map(c => c.id));
                
                filteredData.safe = filteredData.safe.concat(
                    filteredBatch.safe.filter(c => !existingSafeIds.has(c.id))
                );
                filteredData.toxic = filteredData.toxic.concat(
                    filteredBatch.toxic.filter(c => !existingToxicIds.has(c.id))
                );
                Object.assign(filteredData.analysis, filteredBatch.analysis);
                
                // 現在のタブに応じて表示を更新
                if (currentTab === 'filtered') {
                    displayFilteredComments(filteredBatch.safe, true);
                } else if (currentTab === 'toxic') {
                    displayToxicComments(filteredBatch.toxic, filteredData.analysis, true);
                }
                
                // プログレス更新
                updateProgressIndicator(allComments.length - pendingComments.length, allComments.length);
                
                // 次のバッチまで少し待機
                if (pendingComments.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            hideProgressIndicator();
            console.log('Background processing completed');
            
        } catch (error) {
            console.error('Error in background processing:', error);
        } finally {
            isProcessingBackground = false;
        }
    }
    
    // コメントをフィルタリング
    async function filterComments(comments) {
        // サーバー側のプロキシAPIを使用するため、キーチェックは不要
        console.log('Using Perspective API for comment filtering via server proxy');
        
        const safe = [];
        const toxic = [];
        const analysis = {};
        
        // バッチ処理でコメントを分析
        for (const comment of comments) {
            try {
                console.log(`Analyzing comment: "${comment.textOriginal}"`);
                const result = await perspectiveAPI.analyzeComment(comment.textOriginal);
                analysis[comment.id] = result;
                
                console.log(`Comment analysis result:`, {
                    text: comment.textOriginal,
                    isToxic: result.isToxic,
                    scores: result.scores,
                    isJapanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(comment.textOriginal)
                });
                
                if (!result.isToxic) {
                    safe.push(comment);
                } else {
                    toxic.push(comment);
                    console.log(`Toxic comment found: "${comment.textOriginal}"`);
                }
            } catch (error) {
                console.error(`Error analyzing comment "${comment.textOriginal}":`, error);
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
        
        console.log(`Filtering complete: ${safe.length} safe, ${toxic.length} toxic out of ${comments.length} total comments`);
        
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
    
    
    // 有害判定されたコメントを表示
    function displayToxicComments(toxicComments, analysis, append = false) {
        const container = document.getElementById('toxic-comments');
        
        if (!append) {
            container.innerHTML = '';
            
            // 全体の有害コメント数を取得（filteredData.toxicの総数）
            const totalToxicCount = filteredData.toxic.length;
            
            // 0件の場合のみno-toxic-commentsを表示
            if (totalToxicCount === 0) {
                const noToxic = document.createElement('div');
                noToxic.className = 'no-toxic-comments';
                noToxic.innerHTML = '<p>✅ 有害と判定されたコメントはありません</p>';
                container.appendChild(noToxic);
                return;
            }
            
            // ヘッダー情報を追加（全体の件数を表示）
            const header = document.createElement('div');
            header.className = 'toxic-comments-header';
            header.innerHTML = `
                <div class="toxic-info">
                    <h3>⚠️ 有害判定されたコメント (${totalToxicCount}件)</h3>
                    <p>Perspective APIにより有害と判定されたコメントです。表示には注意してください。</p>
                </div>
            `;
            container.appendChild(header);
        }
        
        // 既存のコメントIDを取得
        const existingCommentIds = new Set(
            Array.from(container.querySelectorAll('.comment-item'))
                .map(el => el.dataset.commentId)
                .filter(id => id)
        );
        
        toxicComments.forEach(comment => {
            if (!existingCommentIds.has(comment.id)) {
                const commentElement = createToxicCommentElement(comment, analysis[comment.id]);
                commentElement.dataset.commentId = comment.id;
                container.appendChild(commentElement);
            }
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
    
    // 有害コメント要素を作成
    function createToxicCommentElement(comment, analysisResult) {
        const div = document.createElement('div');
        div.className = 'comment-item toxic-comment';
        
        // 最も高いスコアを取得
        const highestScore = Math.max(...Object.values(analysisResult.scores || {}));
        const highestAttribute = Object.entries(analysisResult.scores || {})
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];
        
        div.innerHTML = `
            <img src="${comment.authorProfileImageUrl}" alt="${comment.authorName}" class="comment-avatar">
            <div class="comment-content">
                <div class="comment-meta">
                    <span class="comment-author">${comment.authorName}</span>
                    <span class="comment-time">${comment.publishedAt}</span>
                    <span class="toxic-badge">🚨 有害判定</span>
                </div>
                <div class="toxic-warning">
                    <p><strong>⚠️ 注意:</strong> このコメントは以下の理由で有害と判定されました</p>
                    <div class="toxic-reason">
                        <span class="highest-score">${highestAttribute}: ${Math.round(highestScore * 100)}%</span>
                    </div>
                </div>
                <details class="toxic-content">
                    <summary>コメント内容を表示 (注意してください)</summary>
                    <p class="comment-text">${comment.text}</p>
                </details>
                ${createDetailedScoreBadges(analysisResult.scores)}
                ${comment.likeCount > 0 ? `<span class="comment-likes">👍 ${comment.likeCount}</span>` : ''}
            </div>
        `;
        
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
    
    // 詳細な毒性スコアバッジを作成（有害コメント用）
    function createDetailedScoreBadges(scores) {
        const badges = [];
        const attributeLabels = {
            'TOXICITY': '毒性',
            'SEVERE_TOXICITY': '重度毒性',
            'INSULT': '侮辱',
            'THREAT': '脅迫',
            'IDENTITY_ATTACK': '個人攻撃'
        };
        
        for (const [attribute, score] of Object.entries(scores)) {
            const percentage = Math.round(score * 100);
            const label = attributeLabels[attribute] || attribute;
            const color = score > 0.7 ? '#ff4444' : score > 0.5 ? '#ff8800' : '#88aa88';
            badges.push(`
                <div class="detailed-score-badge" style="border-left: 4px solid ${color};">
                    <span class="score-label">${label}</span>
                    <span class="score-value">${percentage}%</span>
                </div>
            `);
        }
        
        return badges.length > 0 ? `<div class="detailed-score-badges">${badges.join('')}</div>` : '';
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
        // タブ切り替え
        const personTab = document.getElementById('person-tab');
        const toxicTab = document.getElementById('toxic-tab');
        
        personTab.addEventListener('click', () => {
            switchTab('filtered', personTab, [toxicTab], 'person-comments');
        });
        
        toxicTab.addEventListener('click', () => {
            switchTab('toxic', toxicTab, [personTab], 'toxic-comments');
        });
        
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
        
        // 初期タブ名を設定
        personTab.textContent = 'AIフィルター済み';
        toxicTab.textContent = '有害判定済み';
    }
    
    // タブ切り替えのヘルパー関数
    function switchTab(tab, activeTabElement, inactiveTabElements, activeContentId) {
        currentTab = tab;
        
        // タブのアクティブ状態を更新
        activeTabElement.classList.add('active');
        inactiveTabElements.forEach(el => el.classList.remove('active'));
        
        // コンテンツの表示/非表示を更新
        document.getElementById('person-comments').classList.remove('active');
        document.getElementById('toxic-comments').classList.remove('active');
        document.getElementById(activeContentId).classList.add('active');
        
        // 既存のデータがある場合は再表示、なければ読み込み
        if (filteredData.safe.length > 0 || filteredData.toxic.length > 0) {
            if (currentTab === 'filtered') {
                displayFilteredComments(filteredData.safe);
            } else if (currentTab === 'toxic') {
                displayToxicComments(filteredData.toxic, filteredData.analysis);
            }
        } else {
            // データがない場合は読み込み
            nextPageToken = null;
            loadComments();
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
        let container;
        if (currentTab === 'filtered') {
            container = document.getElementById('person-comments');
        } else if (currentTab === 'toxic') {
            container = document.getElementById('toxic-comments');
        }
        
        // 既にコンテンツがある場合は下部に小さく表示
        if (container.children.length > 0) {
            const loader = document.createElement('div');
            loader.className = 'comment-loader comment-loader-small';
            loader.innerHTML = '<div class="loader-spinner"></div>';
            container.appendChild(loader);
        } else {
            const loader = document.createElement('div');
            loader.className = 'comment-loader';
            loader.innerHTML = '<div class="loader-spinner"></div><p>コメントを読み込んでいます...</p>';
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
        let container;
        if (currentTab === 'filtered') {
            container = document.getElementById('person-comments');
        } else if (currentTab === 'toxic') {
            container = document.getElementById('toxic-comments');
        }
            
        const error = document.createElement('div');
        error.className = 'error-message';
        error.textContent = message;
        container.appendChild(error);
    }
    
    // プログレス表示
    function showProgressIndicator(processed, total) {
        // 既存のプログレスを削除
        const existingProgress = document.querySelector('.analysis-progress');
        if (existingProgress) {
            existingProgress.remove();
        }
        
        const progress = document.createElement('div');
        progress.className = 'analysis-progress';
        progress.innerHTML = `
            <div class="progress-content">
                <span class="progress-text">コメント分析中... (<span class="progress-count">${processed}件)</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(processed / total) * 100}%"></div>
                </div>
            </div>
        `;
        
        // 最初のタブの上部に表示
        const container = document.querySelector('.comment-tabs');
        container.insertAdjacentElement('afterend', progress);
    }
    
    // プログレス更新
    function updateProgressIndicator(processed, total) {
        const progressCount = document.querySelector('.progress-count');
        const progressFill = document.querySelector('.progress-fill');
        
        if (progressCount) {
            progressCount.textContent = processed;
        }
        
        if (progressFill) {
            progressFill.style.width = `${(processed / total) * 100}%`;
        }
    }
    
    // プログレス非表示
    function hideProgressIndicator() {
        const progress = document.querySelector('.analysis-progress');
        if (progress) {
            progress.classList.add('fade-out');
            setTimeout(() => progress.remove(), 300);
        }
    }
});