import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { transcribeAudioBuffer } from '../services/transcriptionService.js';

const router = Router();

router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', language = 'en' } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      language?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'No audio provided' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    if (buffer.length > 6 * 1024 * 1024) {
      return res.status(400).json({ error: 'Recording too large' });
    }

    const text = await transcribeAudioBuffer(buffer, mimeType, language);
    if (!text) {
      return res.status(422).json({ error: 'No speech detected in recording' });
    }

    res.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    if (message === 'recording-too-short') {
      return res.status(400).json({ error: 'Recording too short' });
    }
    if (message === 'transcription-unavailable') {
      return res.status(503).json({ error: 'Speech transcription is not configured on the server' });
    }
    console.error('Transcription error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

export default router;
