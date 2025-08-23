// Expressサーバー
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// .envファイルを読み込む
dotenv.config();

const app = express();
const PORT = process.env.PORT || 30001;
const isDevelopment = process.env.NODE_ENV === 'development';

// ヘルスチェック用エンドポイント
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV || 'unknown' });
});

// CORS設定
if (isDevelopment) {
    // 開発環境では緩いCORS設定
    app.use(cors({
        origin: [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]
    }));
} else {
    // 本番環境では厳格なCORS設定
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : false
    }));
}

// 静的ファイルの提供
app.use(express.static(path.join(__dirname)));

// HTMLファイルへのルーティング
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/video-detail.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'video-detail.html'));
});

// APIキーをクライアントに提供するエンドポイント（開発環境のみ）
app.get('/api/config', (req, res) => {
    if (!isDevelopment) {
        // 本番環境ではAPIキーを公開しない
        return res.status(403).json({ error: 'API keys not available in production' });
    }
    
    // 開発環境のみAPIキーを返す
    res.json({
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
        PERSPECTIVE_API_KEY: process.env.PERSPECTIVE_API_KEY
    });
});

// JSONボディパーサー（Perspective API用）
app.use(express.json());

// Perspective APIプロキシ
app.post('/api/perspective/analyze', async (req, res) => {
    const https = require('https');
    
    if (!process.env.PERSPECTIVE_API_KEY) {
        console.error('Perspective API key not configured in environment variables');
        return res.status(500).json({ error: 'Perspective API key not configured' });
    }
    
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }
    
    console.log('Perspective API request for text:', text.substring(0, 50) + '...');
    
    const postData = JSON.stringify({
        comment: { text },
        requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            INSULT: {},
            THREAT: {},
            IDENTITY_ATTACK: {}
        }
    });
    
    const options = {
        hostname: 'commentanalyzer.googleapis.com',
        path: `/v1alpha1/comments:analyze?key=${process.env.PERSPECTIVE_API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (apiRes.statusCode !== 200) {
                    console.error('Perspective API error:', {
                        status: apiRes.statusCode,
                        error: result,
                        apiKey: process.env.PERSPECTIVE_API_KEY ? 'Set (length: ' + process.env.PERSPECTIVE_API_KEY.length + ')' : 'Not set'
                    });
                    res.status(apiRes.statusCode).json(result);
                } else {
                    console.log('Perspective API success for text length:', text.length);
                    res.json(result);
                }
            } catch (e) {
                console.error('Failed to parse Perspective API response:', e);
                res.status(500).json({ error: 'Invalid JSON response from Perspective API' });
            }
        });
    });
    
    apiReq.on('error', (error) => {
        console.error('Perspective API request error:', error);
        res.status(500).json({ error: 'Failed to connect to Perspective API' });
    });
    
    apiReq.write(postData);
    apiReq.end();
});

// YouTube APIプロキシ
app.get('/api/youtube/*', async (req, res) => {
    const apiPath = req.params[0];
    
    // URLSearchParamsの代わりにquerystringを使用
    const querystring = require('querystring');
    const params = Object.assign({}, req.query, { key: process.env.YOUTUBE_API_KEY });
    const queryString = querystring.stringify(params);
    
    try {
        const https = require('https');
        const url = `https://www.googleapis.com/youtube/v3/${apiPath}?${queryString}`;
        
        https.get(url, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    res.json(JSON.parse(data));
                } catch (e) {
                    res.status(500).json({ error: 'Invalid JSON response' });
                }
            });
        }).on('error', (error) => {
            res.status(500).json({ error: 'API request failed' });
        });
    } catch (error) {
        res.status(500).json({ error: 'API request failed' });
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode on port ${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});