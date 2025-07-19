// 簡易的なローカルサーバー（開発用）
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// .envファイルを読み込む
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS設定（ローカル開発のみ許可）
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000']
}));

// 静的ファイルの提供
app.use(express.static('.'));

// APIキーをクライアントに提供するエンドポイント（ローカルのみ）
app.get('/api/config', (req, res) => {
    // IPアドレスとHostヘッダーの両方をチェック
    const clientIP = req.ip || req.connection.remoteAddress;
    const host = req.get('host');
    
    const isLocalIP = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    const isLocalHost = host && (host.startsWith('localhost') || host.startsWith('127.0.0.1'));
    
    if (!isLocalIP || !isLocalHost) {
        return res.status(403).json({ error: 'API keys only available for localhost' });
    }
    
    res.json({
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
        PERSPECTIVE_API_KEY: process.env.PERSPECTIVE_API_KEY
    });
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});