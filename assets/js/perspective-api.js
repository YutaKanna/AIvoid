// Perspective API 連携クラス
class PerspectiveAPI {
    constructor() {
        this.baseURL = 'https://commentanalyzer.googleapis.com/v1alpha1';
        this.apiKey = null;
    }

    // APIキーを設定
    setAPIKey(apiKey) {
        this.apiKey = apiKey;
    }

    // APIキーを取得
    getAPIKey() {
        // localStorageから取得するか、CONFIG経由で取得
        return this.apiKey || localStorage.getItem('PERSPECTIVE_API_KEY') || 
               (typeof CONFIG !== 'undefined' && CONFIG.PERSPECTIVE_API_KEY) || 
               (typeof getPerspectiveAPIKey !== 'undefined' && getPerspectiveAPIKey()) || null;
    }

    // コメントを分析
    async analyzeComment(text) {
        // サーバー側のプロキシAPIを使用
        try {
            const response = await fetch('/api/perspective/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Perspective API error details:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData,
                    url: response.url,
                    requestBody: { text }
                });
                
                // より詳細なエラーメッセージ
                let errorMessage = `HTTP error! status: ${response.status}`;
                if (errorData.error && errorData.error.message) {
                    errorMessage += ` - ${errorData.error.message}`;
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const scores = {};
            
            // スコアを抽出
            for (const [attribute, value] of Object.entries(data.attributeScores)) {
                scores[attribute] = value.summaryScore.value;
            }

            // 日本語検出
            const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
            
            // 毒性判定（日本語の場合はより低い閾値を使用）
            const thresholds = isJapanese ? {
                TOXICITY: 0.1,
                SEVERE_TOXICITY: 0.1,
                INSULT: 0.1,
                THREAT: 0.1,
                IDENTITY_ATTACK: 0.1
            } : {
                TOXICITY: 0.5,
                SEVERE_TOXICITY: 0.4,
                INSULT: 0.5,
                THREAT: 0.5,
                IDENTITY_ATTACK: 0.5
            };
            
            const isToxic = scores.TOXICITY > thresholds.TOXICITY || 
                          scores.SEVERE_TOXICITY > thresholds.SEVERE_TOXICITY ||
                          scores.INSULT > thresholds.INSULT ||
                          scores.THREAT > thresholds.THREAT ||
                          scores.IDENTITY_ATTACK > thresholds.IDENTITY_ATTACK;

            return { isToxic, scores };
        } catch (error) {
            console.error('Error analyzing comment:', error);
            // エラー時はデフォルトで安全と判定
            return { isToxic: false, scores: {}, error: error.message };
        }
    }

    // 複数のコメントを一括分析
    async analyzeComments(comments) {
        const results = [];
        
        // バッチ処理（API制限を考慮）
        for (const comment of comments) {
            const result = await this.analyzeComment(comment.text);
            results.push({
                ...comment,
                ...result
            });
            
            // レート制限対策（必要に応じて調整）
            await this.sleep(100);
        }
        
        return results;
    }

    // ユーティリティ：スリープ関数
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// グローバルインスタンス
const perspectiveAPI = new PerspectiveAPI();