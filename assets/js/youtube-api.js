// YouTube Data API 連携クラス
class YouTubeAPI {
    constructor() {
        this.baseURL = CONFIG.YOUTUBE_API_BASE_URL;
    }

    // APIキーの確認
    checkAPIKey() {
        const apiKey = getYouTubeAPIKey();
        if (!apiKey) {
            throw new Error('YouTube API Key is not set');
        }
        return apiKey;
    }

    // チャンネル情報を取得
    async getChannelInfo(channelId = CONFIG.DEFAULT_CHANNEL_ID) {
        try {
            let url;
            if (CONFIG.IS_LOCAL) {
                // ローカル開発時はプロキシ経由
                url = `${this.baseURL}/channels?part=snippet,statistics&id=${channelId}`;
            } else {
                const apiKey = this.checkAPIKey();
                url = `${this.baseURL}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                const channel = data.items[0];
                return {
                    title: channel.snippet.title,
                    description: channel.snippet.description,
                    subscriberCount: this.formatNumber(channel.statistics.subscriberCount),
                    videoCount: this.formatNumber(channel.statistics.videoCount),
                    viewCount: this.formatNumber(channel.statistics.viewCount),
                    thumbnail: channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url,
                    customUrl: channel.snippet.customUrl || ''
                };
            } else {
                throw new Error('Channel not found');
            }
        } catch (error) {
            console.error('Error fetching channel info:', error);
            throw error;
        }
    }

    // チャンネルの動画一覧を取得
    async getChannelVideos(channelId = CONFIG.DEFAULT_CHANNEL_ID, maxResults = 10) {
        try {
            let url;
            if (CONFIG.IS_LOCAL) {
                // ローカル開発時はプロキシ経由
                url = `${this.baseURL}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}`;
            } else {
                const apiKey = this.checkAPIKey();
                url = `${this.baseURL}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.items) {
                // 各動画の統計情報を取得
                const videoIds = data.items.map(item => item.id.videoId).join(',');
                const videosWithStats = await this.getVideosStatistics(videoIds);
                
                return data.items.map((item, index) => ({
                    id: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnail: item.snippet.thumbnails.medium.url,
                    publishedAt: this.formatDate(item.snippet.publishedAt),
                    viewCount: videosWithStats[index]?.viewCount || '0',
                    likeCount: videosWithStats[index]?.likeCount || '0',
                    commentCount: videosWithStats[index]?.commentCount || '0'
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching channel videos:', error);
            throw error;
        }
    }

    // 動画の統計情報を取得
    async getVideosStatistics(videoIds) {
        try {
            let url;
            if (CONFIG.IS_LOCAL) {
                // ローカル開発時はプロキシ経由
                url = `${this.baseURL}/videos?part=statistics&id=${videoIds}`;
            } else {
                const apiKey = this.checkAPIKey();
                url = `${this.baseURL}/videos?part=statistics&id=${videoIds}&key=${apiKey}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            return data.items.map(item => ({
                viewCount: this.formatNumber(item.statistics.viewCount),
                likeCount: this.formatNumber(item.statistics.likeCount),
                commentCount: this.formatNumber(item.statistics.commentCount)
            }));
        } catch (error) {
            console.error('Error fetching video statistics:', error);
            return [];
        }
    }

    // 数値のフォーマット（万単位）
    formatNumber(num) {
        const number = parseInt(num);
        if (number >= 10000) {
            return Math.floor(number / 10000) + '.' + Math.floor((number % 10000) / 1000) + '万';
        }
        return number.toLocaleString();
    }

    // 日付のフォーマット
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return '1日前';
        } else if (diffDays < 7) {
            return `${diffDays}日前`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks}週間前`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months}ヶ月前`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `${years}年前`;
        }
    }

    // 動画の詳細情報を取得
    async getVideoDetails(videoId) {
        try {
            let url;
            if (CONFIG.IS_LOCAL) {
                url = `${this.baseURL}/videos?part=snippet,statistics&id=${videoId}`;
            } else {
                const apiKey = this.checkAPIKey();
                url = `${this.baseURL}/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const video = data.items[0];
                return {
                    id: video.id,
                    title: video.snippet.title,
                    description: video.snippet.description,
                    thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
                    viewCount: this.formatNumber(video.statistics.viewCount),
                    likeCount: this.formatNumber(video.statistics.likeCount),
                    commentCount: this.formatNumber(video.statistics.commentCount),
                    publishedAt: this.formatDate(video.snippet.publishedAt)
                };
            }
            throw new Error('Video not found');
        } catch (error) {
            console.error('Error fetching video details:', error);
            throw error;
        }
    }

    // 動画のコメントを取得
    async getVideoComments(videoId, pageToken = null, maxResults = 20) {
        try {
            let url;
            if (CONFIG.IS_LOCAL) {
                url = `${this.baseURL}/commentThreads?part=snippet,replies&videoId=${videoId}&order=relevance&maxResults=${maxResults}`;
                if (pageToken) url += `&pageToken=${pageToken}`;
            } else {
                const apiKey = this.checkAPIKey();
                url = `${this.baseURL}/commentThreads?part=snippet,replies&videoId=${videoId}&order=relevance&maxResults=${maxResults}&key=${apiKey}`;
                if (pageToken) url += `&pageToken=${pageToken}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const comments = [];
            
            if (data.items) {
                for (const item of data.items) {
                    const topLevelComment = item.snippet.topLevelComment.snippet;
                    comments.push({
                        id: item.id,
                        text: topLevelComment.textDisplay,
                        textOriginal: topLevelComment.textOriginal,
                        authorName: topLevelComment.authorDisplayName,
                        authorProfileImageUrl: topLevelComment.authorProfileImageUrl,
                        likeCount: topLevelComment.likeCount,
                        publishedAt: this.formatDate(topLevelComment.publishedAt),
                        updatedAt: this.formatDate(topLevelComment.updatedAt),
                        replyCount: item.snippet.totalReplyCount || 0,
                        replies: []
                    });
                    
                    // 返信コメントも取得
                    if (item.replies && item.replies.comments) {
                        for (const reply of item.replies.comments) {
                            comments[comments.length - 1].replies.push({
                                id: reply.id,
                                text: reply.snippet.textDisplay,
                                textOriginal: reply.snippet.textOriginal,
                                authorName: reply.snippet.authorDisplayName,
                                authorProfileImageUrl: reply.snippet.authorProfileImageUrl,
                                likeCount: reply.snippet.likeCount,
                                publishedAt: this.formatDate(reply.snippet.publishedAt),
                                updatedAt: this.formatDate(reply.snippet.updatedAt)
                            });
                        }
                    }
                }
            }
            
            return {
                comments,
                nextPageToken: data.nextPageToken || null,
                totalResults: data.pageInfo?.totalResults || 0
            };
        } catch (error) {
            console.error('Error fetching video comments:', error);
            throw error;
        }
    }
}

// グローバルインスタンス
const youtubeAPI = new YouTubeAPI();