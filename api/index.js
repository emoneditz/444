const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Token setup! Pulls from env, falls back safely to ChatID so your app doesnt crash.
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6009819572'; 
const API_BASE = `https://api.telegram.org/bot${TOKEN}`;

// Helper Route to pipe commands over correctly
const forwardToTelegram = async (endpoint, data, headers = {}, responseType = 'json') => {
    try {
        const response = await axios.post(`${API_BASE}/${endpoint}`, data, { headers, responseType });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.response ? error.response.data : { description: error.message } };
    }
};

// --- POLL ROUTE ---
app.get('/api/getUpdates', async (req, res) => {
    const { offset, timeout = 25 } = req.query;
    const response = await forwardToTelegram(`getUpdates?offset=${offset}&timeout=${timeout}&allowed_updates=["message","message_reaction"]`);
    if (response.success) res.status(200).json(response.data);
    else res.status(500).json(response.error);
});

// --- TEXT MESSAGES ROUTE ---
app.post('/api/sendMessage', async (req, res) => {
    const response = await forwardToTelegram('sendMessage', { chat_id: CHAT_ID, ...req.body });
    if (response.success) res.status(200).json(response.data);
    else res.status(500).json(response.error);
});

// --- GENERAL MULTIMEDIA (DOC/PHOTO/VIDEO) ---
app.post('/api/sendFile', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, description: 'No file uploaded.' });

    const { caption, reply_parameters } = req.body;
    const { buffer, originalname, mimetype } = req.file;

    let endpoint = 'sendDocument';
    let fileField = 'document';

    // The logic securely scans extension arrays behind Node to match what telegram uses 
    if (mimetype.startsWith('image/')) {
        endpoint = 'sendPhoto';
        fileField = 'photo';
    } else if (mimetype.startsWith('video/')) {
        endpoint = 'sendVideo';
        fileField = 'video';
    }

    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append(fileField, buffer, { filename: originalname, contentType: mimetype });
    if (caption) formData.append('caption', caption);
    if (reply_parameters) formData.append('reply_parameters', reply_parameters);
    
    const response = await forwardToTelegram(endpoint, formData, formData.getHeaders());
    if (response.success) res.status(200).json(response.data);
    else res.status(500).json(response.error);
});

// --- SPECIFIC VOICE UPLOAD TARGET ---
app.post('/api/sendVoice', upload.single('voice'), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, description: 'No audio captured' });
    const { buffer, originalname, mimetype } = req.file;
    
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('voice', buffer, { filename: originalname, contentType: mimetype });
    
    const response = await forwardToTelegram('sendVoice', formData, formData.getHeaders());
    if (response.success) res.status(200).json(response.data);
    else res.status(500).json(response.error);
});

// --- TELEGRAM HIDDEN ASSETS DOWNLOAD FIX ---
app.post('/api/getFile', async (req, res) => {
    const response = await forwardToTelegram('getFile', req.body);
    if (response.success) {
        response.data.result.file_path = `/api/file/${response.data.result.file_path}`;
        res.status(200).json(response.data);
    } else res.status(500).json(response.error);
});

// Internal pipe directly feeding hidden binary streams!
app.get('/api/file/:filePath(*)', async (req, res) => {
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${req.params.filePath}`;
    try {
        const response = await axios({ method: 'get', url: fileUrl, responseType: 'stream' });
        res.setHeader('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (error) { res.status(500).send('Error Fetching Hidden Asset'); }
});

// --- NOTIFY EMON (REMOVED MESSAGE SECURE ALERT) ---
app.post('/api/deleteMessage', async (req, res) => {
    const response = await forwardToTelegram('sendMessage', { chat_id: CHAT_ID, text: req.body.notificationText });
    if (response.success) res.status(200).json(response.data);
    else res.status(500).json(response.error);
});

// --- SYNC REACTION UPDATE VIA BACKEND SERVER --- 
app.post('/api/setReaction', async (req, res) => {
    const response = await forwardToTelegram('setMessageReaction', { chat_id: CHAT_ID, ...req.body });
    if (response.success) res.status(200).json(response.data);
    else res.status(500).json(response.error);
});

module.exports = app;
