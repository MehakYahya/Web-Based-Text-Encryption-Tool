const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Data file path
const DATA_FILE = path.join(__dirname, 'data.json');

// Helper function to read data
const readData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
        return { users: [], messages: [] };
    } catch (error) {
        return { users: [], messages: [] };
    }
};

const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// AES Encryption Key (In production, use environment variables)
const AES_KEY = 'your-secret-key-32-chars-long!';

// Encryption endpoints
app.post('/api/encrypt', (req, res) => {
    try {
        const { text, algorithm, options = {} } = req.body;

        if (!text || !algorithm) {
            return res.status(400).json({
                success: false,
                error: 'Text and algorithm are required'
            });
        }

        let encrypted;
        let keyUsed = null;

        switch (algorithm) {
            case 'caesar':
                const shift = options.shift || 3;
                encrypted = caesarCipher(text, shift);
                break;

            case 'base64':
                encrypted = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text));
                break;

            case 'aes':
                keyUsed = options.key || AES_KEY;
                encrypted = CryptoJS.AES.encrypt(text, keyUsed).toString();
                break;

            case 'sha256':
                encrypted = CryptoJS.SHA256(text).toString();
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported algorithm'
                });
        }

        res.json({
            success: true,
            encryptedText: encrypted,
            algorithm,
            keyUsed: keyUsed ? 'Provided key used' : undefined
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Encryption failed: ' + error.message
        });
    }
});

app.post('/api/decrypt', (req, res) => {
    try {
        const { text, algorithm, options = {} } = req.body;

        if (!text || !algorithm) {
            return res.status(400).json({
                success: false,
                error: 'Text and algorithm are required'
            });
        }

        let decrypted;

        switch (algorithm) {
            case 'caesar':
                const shift = options.shift || 3;
                decrypted = caesarCipher(text, -shift);
                break;

            case 'base64':
                decrypted = CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(text));
                break;

            case 'aes':
                const keyUsed = options.key || AES_KEY;
                const bytes = CryptoJS.AES.decrypt(text, keyUsed);
                decrypted = bytes.toString(CryptoJS.enc.Utf8);
                if (!decrypted) {
                    throw new Error('Decryption failed - check your key');
                }
                break;

            case 'sha256':
                return res.status(400).json({
                    success: false,
                    error: 'SHA-256 is a one-way hash and cannot be decrypted'
                });

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported algorithm'
                });
        }

        res.json({
            success: true,
            decryptedText: decrypted,
            algorithm
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Decryption failed: ' + error.message
        });
    }
});

// Caesar Cipher implementation
function caesarCipher(text, shift) {
    return text.replace(/[a-zA-Z]/g, (char) => {
        const base = char <= 'Z' ? 65 : 97;
        return String.fromCharCode(((char.charCodeAt(0) - base + shift + 26) % 26) + base);
    });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Encryption API is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Encryption backend server running on port ${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`🔗 CORS enabled for all origins`);
});