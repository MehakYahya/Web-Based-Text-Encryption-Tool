class EncryptionTool {
    constructor() {
        this.API_BASE_URL = 'http://localhost:3000/api';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Algorithm selection change
        document.getElementById('algorithm').addEventListener('change', (e) => {
            this.toggleAlgorithmOptions(e.target.value);
        });

        // Encrypt button
        document.getElementById('encryptBtn').addEventListener('click', () => {
            this.handleEncryption();
        });

        // Decrypt button
        document.getElementById('decryptBtn').addEventListener('click', () => {
            this.handleDecryption();
        });

        // Copy button
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copyToClipboard();
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAll();
        });
    }

    toggleAlgorithmOptions(algorithm) {
        const caesarOptions = document.getElementById('caesarOptions');
        const decryptBtn = document.getElementById('decryptBtn');

        // Show/hide Caesar cipher options
        if (algorithm === 'caesar') {
            caesarOptions.style.display = 'block';
        } else {
            caesarOptions.style.display = 'none';
        }

        // Show/hide decrypt button
        if (algorithm === 'sha256') {
            decryptBtn.style.display = 'none'; // SHA-256 is one-way
        } else if (algorithm) {
            decryptBtn.style.display = 'block';
        } else {
            decryptBtn.style.display = 'none';
        }
    }

    validateInput() {
        const plainText = document.getElementById('plainText').value.trim();
        const algorithm = document.getElementById('algorithm').value;

        if (!plainText) {
            this.showError('Please enter some text to encrypt.');
            return false;
        }

        if (!algorithm) {
            this.showError('Please select an encryption algorithm.');
            return false;
        }

        return true;
    }

    async makeApiCall(endpoint, data) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            return await response.json();
        } catch (error) {
            throw new Error('Backend connection failed: ' + error.message);
        }
    }

    async handleEncryption() {
        if (!this.validateInput()) return;

        const plainText = document.getElementById('plainText').value;
        const algorithm = document.getElementById('algorithm').value;
        const shift = document.getElementById('shift')?.value || 3;

        try {
            this.setLoading(true);
            
            // Try backend API first
            try {
                const result = await this.makeApiCall('encrypt', {
                    text: plainText,
                    algorithm: algorithm,
                    options: { shift: parseInt(shift) }
                });

                if (result.success) {
                    document.getElementById('cipherText').value = result.encryptedText;
                    this.showSuccess('Text encrypted successfully!');
                    return;
                } else {
                    throw new Error(result.error);
                }
            } catch (apiError) {
                console.warn('Backend failed, using client-side encryption:', apiError.message);
                // Fallback to client-side encryption (await result)
                const result = await this.clientSideEncryption(plainText, algorithm, shift);
                document.getElementById('cipherText').value = result;
                this.showSuccess('Text encrypted successfully!');
            }

        } catch (error) {
            this.showError('Encryption failed: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    async handleDecryption() {
        const cipherEl = document.getElementById('cipherText');
        const plainEl = document.getElementById('plainText');
        const decryptedEl = document.getElementById('decryptedText');

        const cipherText = cipherEl.value.trim();
        const plainText = plainEl.value.trim();
        const algorithm = document.getElementById('algorithm').value;
        const shift = document.getElementById('shift')?.value || 3;

        // Use plainText as the preferred source for decryption (user requested)
        // but fall back to cipherText if plainText is empty.
        const sourceText = plainText || cipherText;

        if (!sourceText) {
            this.showError('No text found to decrypt. Enter text in the Plain Text box or paste the encrypted text into the Encrypted Text box.');
            return;
        }

        if (!algorithm) {
            this.showError('Please select an encryption algorithm.');
            return;
        }

        try {
            this.setLoading(true);

            // Try backend API first
            try {
                const result = await this.makeApiCall('decrypt', {
                    text: sourceText,
                    algorithm: algorithm,
                    options: { shift: parseInt(shift) }
                });

                if (result.success) {
                    decryptedEl.value = result.decryptedText;
                    this.showSuccess('Text decrypted successfully!');
                    return;
                } else {
                    throw new Error(result.error);
                }
            } catch (apiError) {
                console.warn('Backend failed, using client-side decryption:', apiError.message);
                // Fallback to client-side decryption (returns the result)
                const result = this.clientSideDecryption(sourceText, algorithm, shift);
                decryptedEl.value = result;
                this.showSuccess('Text decrypted successfully!');
            }

        } catch (error) {
            this.showError('Decryption failed: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    // Client-side encryption fallback
    async clientSideEncryption(plainText, algorithm, shift) {
        let result;
        switch (algorithm) {
            case 'caesar':
                result = this.caesarCipher(plainText, parseInt(shift));
                break;
            case 'base64':
                result = this.base64Encode(plainText);
                break;
            case 'aes':
                result = this.clientSideAESEncrypt(plainText);
                break;
            case 'sha256':
                // SHA-256 is async
                result = await this.clientSideSHA256Hash(plainText);
                break;
            default:
                throw new Error('Unknown algorithm');
        }

        // Return the encrypted result so the caller can display it.
        return result;
    }

    // Client-side decryption fallback
    clientSideDecryption(cipherText, algorithm, shift) {
        let result;
        switch (algorithm) {
            case 'caesar':
                result = this.caesarCipher(cipherText, -parseInt(shift));
                break;
            case 'base64':
                result = this.base64Decode(cipherText);
                break;
            case 'aes':
                result = this.clientSideAESDecrypt(cipherText);
                break;
            default:
                throw new Error('Decryption not supported for this algorithm');
        }

        // Return the decrypted text so the caller can decide where to display it.
        return result;
    }

    // Caesar Cipher Implementation
    caesarCipher(text, shift) {
        return text.replace(/[a-zA-Z]/g, (char) => {
            const base = char <= 'Z' ? 65 : 97;
            return String.fromCharCode(((char.charCodeAt(0) - base + shift + 26) % 26) + base);
        });
    }

    // Base64 Implementation
    base64Encode(text) {
        return btoa(unescape(encodeURIComponent(text)));
    }

    base64Decode(text) {
        try {
            return decodeURIComponent(escape(atob(text)));
        } catch {
            throw new Error('Invalid Base64 string');
        }
    }

    // Client-side AES Encryption (simplified version)
    clientSideAESEncrypt(text) {
        const key = 'demo-key-12345';
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(result);
    }

    clientSideAESDecrypt(encryptedText) {
        try {
            const key = 'demo-key-12345';
            const text = atob(encryptedText);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return result;
        } catch (error) {
            throw new Error('AES decryption failed');
        }
    }

    // Client-side SHA-256 Hash
    async clientSideSHA256Hash(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Utility Methods
    async copyToClipboard() {
        const cipherText = document.getElementById('cipherText');
        
        if (!cipherText.value.trim()) {
            this.showError('No text to copy.');
            return;
        }

        try {
            await navigator.clipboard.writeText(cipherText.value);
            this.showSuccess('Copied to clipboard!');
        } catch (err) {
            cipherText.select();
            document.execCommand('copy');
            this.showSuccess('Copied to clipboard!');
        }
    }

    clearAll() {
        document.getElementById('plainText').value = '';
        document.getElementById('cipherText').value = '';
        document.getElementById('algorithm').value = '';
        document.getElementById('caesarOptions').style.display = 'none';
        document.getElementById('decryptBtn').style.display = 'none';
        this.showSuccess('All fields cleared!');
    }

    setLoading(loading) {
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.classList.toggle('loading', loading);
        });
        
        const inputs = document.querySelectorAll('textarea, select, input, button');
        inputs.forEach(input => {
            if (input.id !== 'clearBtn') {
                input.disabled = loading;
            }
        });
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    async testBackendConnection() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/health`);
            const data = await response.json();
            return data.success;
        } catch (error) {
            return false;
        }
    }
}

// Initialize the encryption tool when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const encryptionTool = new EncryptionTool();
    
    const isBackendConnected = await encryptionTool.testBackendConnection();
    if (isBackendConnected) {
        console.log('✅ Backend connected successfully');
    } else {
        console.log('⚠️ Backend not connected, using client-side encryption');
    }
});