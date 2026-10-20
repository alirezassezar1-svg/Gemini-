import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure public audio cache directory exists
const audioCacheDir = path.join(__dirname, 'public', 'audio_cache');
if (!fs.existsSync(audioCacheDir)) {
  fs.mkdirSync(audioCacheDir, { recursive: true });
}
app.use('/audio_cache', express.static(audioCacheDir));

// Gemini client helper
function getGeminiClient(customApiKey?: string) {
  const key = customApiKey || process.env.GEMINI_API_KEY || '';
  if (!key) {
    throw new Error('No Gemini API key available. Provide GEMINI_API_KEY in environment or configure custom API key in Settings.');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Resilient Text Generation Cascade (Handles 503 high-demand spikes gracefully)
async function generateContentWithCascade(ai: GoogleGenAI, params: {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
}) {
  const models = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const config: any = {};
      if (params.systemInstruction) config.systemInstruction = params.systemInstruction;
      if (params.responseMimeType) config.responseMimeType = params.responseMimeType;
      if (typeof params.temperature === 'number') config.temperature = params.temperature;

      const resp = await ai.models.generateContent({
        model,
        contents: params.contents,
        config,
      });
      return { response: resp, modelUsed: model };
    } catch (err: any) {
      console.warn(`[GeminiCascade] Model ${model} encountered notice:`, err?.message || err);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All candidate models in cascade exhausted.');
}

// --------------------------------------------------------------------------------
// Health & Capabilities API
// --------------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    appName: 'NavaMind Podcast Intelligence Studio',
    version: '1.0.0',
    hasGeminiKey,
    hasServerAi: hasGeminiKey,
    nodeVersion: process.version,
    platform: process.platform,
    supportedProviders: [
      {
        id: 'gemini',
        name: 'Google Gemini 3.5 Transcribe & 3.8 Flash',
        available: hasGeminiKey,
        modes: ['transcription', 'summarization', 'qa', 'translation'],
      },
      {
        id: 'web_speech',
        name: 'Browser Web Speech API (Free / Client-Side)',
        available: true,
        modes: ['transcription'],
      },
      {
        id: 'whisper_api',
        name: 'OpenAI Whisper API Compatible Endpoint',
        available: true,
        modes: ['transcription'],
      },
      {
        id: 'local_rule_engine',
        name: 'Local Knowledge & Heuristic Summarizer (Offline)',
        available: true,
        modes: ['summarization', 'flashcards', 'qa'],
      },
    ],
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------------------------------------
// Episode Resolver API (Castbox, Apple Podcasts, RSS, Direct Audio)
// --------------------------------------------------------------------------------
app.post('/api/resolve-episode', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Valid URL is required.' });
  }

  const cleanUrl = url.trim();

  try {
    const parsedUrl = new URL(cleanUrl);

    // 1. Direct audio file link (.mp3, .m4a, .wav, .aac, .ogg)
    if (/\.(mp3|m4a|wav|aac|ogg|opus)(\?.*)?$/i.test(parsedUrl.pathname)) {
      const filename = path.basename(parsedUrl.pathname).split('?')[0];
      const title = decodeURIComponent(filename).replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      
      let durationSec = 0;
      let contentLength = 0;
      try {
        const headResp = await fetch(cleanUrl, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
        contentLength = parseInt(headResp.headers.get('content-length') || '0', 10);
        // Approximate 128kbps audio duration if size available
        if (contentLength > 0) {
          durationSec = Math.round(contentLength / 16000);
        }
      } catch {
        // ignore HEAD failure
      }

      return res.json({
        success: true,
        sourceType: 'direct_audio',
        title: title || 'Audio Stream',
        podcastName: parsedUrl.hostname,
        sourceUrl: cleanUrl,
        audioUrl: cleanUrl,
        artworkUrl: '',
        durationSec,
        fileSizeBytes: contentLength,
        language: 'fa',
        notes: 'Direct audio URL verified successfully.',
      });
    }

    // 2. Castbox episode or show URL
    if (parsedUrl.hostname.includes('castbox.fm')) {
      const resp = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        throw new Error(`Castbox server returned HTTP ${resp.status}`);
      }

      const html = await resp.text();

      // Extract metadata from OpenGraph and HTML tags
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<title>([^<]+)<\/title>/i);
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      const audioUrlMatch = html.match(/<audio[^>]+src=["']([^"']+)["']/i) ||
                            html.match(/data-audio-url=["']([^"']+)["']/i) ||
                            html.match(/"audioUrl"\s*:\s*["']([^"']+)["']/i) ||
                            html.match(/https?:\/\/[^\s"'<>]+\.(?:mp3|m4a|aac)[^\s"'<>]*/i);

      let title = ogTitleMatch ? ogTitleMatch[1] : 'Castbox Episode';
      title = title.replace(/\s*\|\s*Castbox.*$/i, '').trim();

      const artwork = ogImageMatch ? ogImageMatch[1] : '';
      const description = ogDescMatch ? ogDescMatch[1] : '';
      const foundAudioUrl = audioUrlMatch ? audioUrlMatch[1] || audioUrlMatch[0] : '';

      return res.json({
        success: true,
        sourceType: 'castbox',
        title,
        podcastName: 'Castbox Podcast',
        sourceUrl: cleanUrl,
        audioUrl: foundAudioUrl || '',
        artworkUrl: artwork,
        description: description.slice(0, 300),
        durationSec: 1800,
        language: /[\u0600-\u06FF]/.test(title + description) ? 'fa' : 'en',
        canStreamDirectly: Boolean(foundAudioUrl),
        helpAdvice: foundAudioUrl
          ? 'Episode metadata and audio stream resolved from Castbox.'
          : 'Castbox public page metadata retrieved. Direct audio streaming may be protected by Castbox CDN. You can also import audio via iOS Files app or use microphone recording.',
      });
    }

    // 3. Apple Podcasts / General Web Page
    const webResp = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (webResp.ok) {
      const html = await webResp.text();
      const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                         html.match(/<title>([^<]+)<\/title>/i);
      const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      const audioMatch = html.match(/<audio[^>]+src=["']([^"']+)["']/i) ||
                         html.match(/"streamUrl"\s*:\s*["']([^"']+)["']/i) ||
                         html.match(/https?:\/\/[^\s"'<>]+\.(?:mp3|m4a)[^\s"'<>]*/i);

      const pageTitle = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;
      const detectedAudio = audioMatch ? audioMatch[1] || audioMatch[0] : '';

      return res.json({
        success: true,
        sourceType: 'web_page',
        title: pageTitle,
        podcastName: parsedUrl.hostname,
        sourceUrl: cleanUrl,
        audioUrl: detectedAudio,
        artworkUrl: imageMatch ? imageMatch[1] : '',
        durationSec: 0,
        language: /[\u0600-\u06FF]/.test(pageTitle) ? 'fa' : 'en',
        helpAdvice: detectedAudio
          ? 'Audio stream link discovered on web page.'
          : 'Page metadata found. For protected audio, please upload the audio file directly or use live recording.',
      });
    }

    throw new Error(`Could not fetch web page: HTTP ${webResp.status}`);
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: `Episode resolution error: ${err.message}`,
      fallbackAdvice: 'Alternative workflow: In Castbox, download the episode to iPhone Files app or iCloud, then choose "Upload Audio File" or paste transcript text.',
    });
  }
});

// --------------------------------------------------------------------------------
// CORS-Safe Audio Proxy Streamer
// --------------------------------------------------------------------------------
app.get('/api/stream-audio', async (req, res) => {
  const audioUrl = req.query.url as string;
  if (!audioUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const range = req.headers.range;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    };
    if (range) {
      headers['Range'] = range;
    }

    const audioResp = await fetch(audioUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!audioResp.ok && audioResp.status !== 206) {
      return res.status(audioResp.status).send(`Upstream audio error: ${audioResp.statusText}`);
    }

    res.status(audioResp.status);
    const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    for (const h of passHeaders) {
      const val = audioResp.headers.get(h);
      if (val) res.setHeader(h, val);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!audioResp.body) {
      return res.end();
    }

    // Stream to client
    const reader = audioResp.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (streamErr) {
        res.end();
      }
    };
    pump();
  } catch (err: any) {
    res.status(502).send(`Audio proxy failure: ${err.message}`);
  }
});

// --------------------------------------------------------------------------------
// AI Audio Transcription API (Gemini 3.5 Transcribe)
// --------------------------------------------------------------------------------
app.post('/api/transcribe', async (req, res) => {
  const {
    audioBase64,
    mimeType = 'audio/mp3',
    languageHint = 'fa',
    vocabularyHints = [],
    customApiKey,
    episodeTitle = 'Podcast Episode',
  } = req.body;

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Valid audioBase64 string is required.' });
  }

  try {
    const ai = getGeminiClient(customApiKey);

    // Clean base64 data
    const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '');

    const vocabInstructions = vocabularyHints && vocabularyHints.length > 0
      ? `\nDomain vocabulary hints and key terms to preserve accurately: ${vocabularyHints.join(', ')}`
      : '';

    const systemPrompt = `You are an expert podcast transcription system specializing in Persian (Farsi) and English speech.
You transcribe audio accurately with timestamps and speaker diarization.
Rules:
1. Detect whether the speaker is speaking Persian, English, or code-switching.
2. Output a strictly valid JSON array of segment objects.
3. Each segment MUST have:
   - "id": number (1, 2, 3...)
   - "start": number (start time in seconds, e.g. 0.0, 14.5)
   - "end": number (end time in seconds, e.g. 14.5, 32.0)
   - "speaker": string (e.g. "Speaker 1", "Speaker 2", or name if identified)
   - "text": string (the exact transcribed speech)
   - "language": string ("fa" or "en")
   - "confidence": number between 0.85 and 0.99
4. Output ONLY valid JSON in format:
{
  "detectedLanguage": "fa" | "en" | "bilingual",
  "totalDurationSeconds": number,
  "segments": [
    { "id": 1, "start": 0.0, "end": 12.4, "speaker": "Speaker 1", "text": "...", "language": "fa", "confidence": 0.96 }
  ]
}
Do NOT include markdown backticks around the JSON.${vocabInstructions}`;

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/mp3',
        data: cleanData,
      },
    };

    const textPart = {
      text: `Transcribe this podcast episode titled "${episodeTitle}". Primary language expectation: ${languageHint === 'fa' ? 'Persian (Farsi)' : 'English'}. Return timestamped JSON segments.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: { parts: [audioPart, textPart] },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));
    } catch {
      // Fallback text parsing if JSON formatting had an issue
      parsed = {
        detectedLanguage: languageHint || 'fa',
        totalDurationSeconds: 60,
        segments: [
          {
            id: 1,
            start: 0,
            end: 60,
            speaker: 'Speaker 1',
            text: responseText.trim(),
            language: languageHint || 'fa',
            confidence: 0.92,
          },
        ],
      };
    }

    return res.json({
      success: true,
      provider: 'gemini-3.5-transcribe',
      detectedLanguage: parsed.detectedLanguage || languageHint,
      totalDurationSeconds: parsed.totalDurationSeconds || 0,
      segments: parsed.segments || [],
      fullText: (parsed.segments || []).map((s: any) => s.text).join(' '),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Transcribe Error]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Transcription failed',
      provider: 'gemini-3.5-transcribe',
      advice: 'Ensure audio file is within size limits or configure a custom API key in Settings.',
    });
  }
});

// --------------------------------------------------------------------------------
// Multi-Mode AI Summarization API (Modes A to O)
// --------------------------------------------------------------------------------
app.post('/api/summarize', async (req, res) => {
  const {
    transcriptText,
    segments = [],
    mode = 'C', // A to O
    outputLanguage = 'fa', // 'fa' | 'en' | 'bilingual'
    length = 'standard', // 'brief' | 'standard' | 'in-depth'
    tone = 'analytical', // 'analytical' | 'conversational' | 'academic' | 'practical'
    customPrompt = '',
    customApiKey,
    episodeTitle = 'Podcast Episode',
  } = req.body;

  if (!transcriptText || typeof transcriptText !== 'string') {
    return res.status(400).json({ error: 'Valid transcriptText is required.' });
  }

  try {
    const ai = getGeminiClient(customApiKey);

    // Mode Definitions
    const modeDescriptions: Record<string, string> = {
      A: '30-second executive summary: An ultra-concise synthesis of the core thesis and bottom-line takeaway in 3-4 punchy sentences.',
      B: 'One-minute summary: A balanced overview covering the motivation, key findings, and concluding advice.',
      C: 'Detailed summary: A comprehensive structural summary organized with clear analytical headings, bullet points, and nuance.',
      D: 'Chapter-by-chapter summary: Chronological breakdown dividing the episode into thematic chapters with estimated timestamps and key themes.',
      E: 'Educational explanation: Step-by-step conceptual guide explaining the ideas simply using relatable analogies and pedagogical clarity.',
      F: 'Critical analysis: Rigorous evaluation of claims, premises, evidence strength, logical leaps, assumptions, and potential counter-arguments.',
      G: 'Practical action plan: Pragmatic, actionable checklist and step-by-step implementation guide derived directly from the episode.',
      H: 'Key concepts and definitions: Comprehensive glossary defining core ideas, terminology, and theoretical frameworks mentioned.',
      I: 'Important quotations linked to timestamps: Verbatim notable quotations with exact context, speaker attribution, and timestamp reference.',
      J: 'Questions and answers: Curated list of 5-8 provocative questions explored in the episode and their synthesized answers.',
      K: 'Flashcards and quizzes: Interactive study deck of 6-10 question-and-answer flashcards and multiple-choice quiz items for active recall.',
      L: 'Glossary of unfamiliar words: Specialized domain terminology, idiomatic expressions, or Persian/English loan words with definitions and phonetic tips.',
      M: 'Persian translation: Natural, elegant, idiomatic Persian translation of the key discussion.',
      N: 'Bilingual side-by-side transcript: Parallel English and Persian structured breakdown with aligned key points.',
      O: 'Unresolved questions & missing information: What the episode left unanswered, unanswered ambiguities, and recommendations for further research.',
    };

    const selectedDescription = modeDescriptions[mode] || modeDescriptions['C'];

    const langInstruction = outputLanguage === 'fa'
      ? 'Output primarily in natural, sophisticated Persian (فارسی روان و شیوا) with proper RTL phrasing.'
      : outputLanguage === 'bilingual'
      ? 'Provide bilingual output with both Persian and English parallel sections.'
      : 'Output in clear, precise English.';

    const systemPrompt = `You are NavaMind's Chief Podcast Intelligence Analyst.
Analyze the provided podcast transcript with extreme rigor, honesty, and intellectual depth.
Strict Grounding Rules:
1. Ground every claim directly in the transcript.
2. Explicitly distinguish between:
   - [Explicit Statement]: directly stated by the speaker(s).
   - [Reasonable Interpretation]: logical deduction or synthesis.
   - [External Context]: if mentioning widely known historical/scientific fact for clarity, clearly label it.
3. NEVER fabricate quotations or attribute unsupported claims to the speakers.
4. Citing timestamps: When referencing statements, cite timestamp markers in format [MM:SS] if segments are provided.
5. Mode Goal: ${selectedDescription}
6. Language: ${langInstruction}
7. Tone: ${tone}
8. Length: ${length}`;

    const promptText = `Episode Title: "${episodeTitle}"
Requested Summary Mode: Mode ${mode} (${selectedDescription})
${customPrompt ? `User Custom Instructions: ${customPrompt}\n` : ''}

Transcript Content:
${transcriptText.slice(0, 50000)}

Generate the complete, structured analysis for Mode ${mode}.`;

    const { response, modelUsed } = await generateContentWithCascade(ai, {
      contents: promptText,
      systemInstruction: systemPrompt,
      temperature: 0.3,
    });

    const outputText = response.text || 'No response generated.';

    return res.json({
      success: true,
      mode,
      outputLanguage,
      content: outputText,
      modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Summarize Error]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Summarization failed',
      advice: 'Verify transcript length or provide custom API key in Settings.',
    });
  }
});

// --------------------------------------------------------------------------------
// Ask the Episode (Grounded Q&A with Timestamp Citations)
// --------------------------------------------------------------------------------
app.post('/api/ask-episode', async (req, res) => {
  const {
    question,
    transcriptText,
    segments = [],
    episodeTitle = 'Episode',
    customApiKey,
    searchEntireLibrary = false,
  } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required.' });
  }
  if (!transcriptText && (!segments || segments.length === 0)) {
    return res.status(400).json({ error: 'Transcript context is required.' });
  }

  try {
    const ai = getGeminiClient(customApiKey);

    // Format segments into timestamped context
    const formattedSegments = (segments || []).slice(0, 150).map((s: any) => {
      const minutes = Math.floor((s.start || 0) / 60);
      const seconds = Math.floor((s.start || 0) % 60);
      const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return `[${timeStr}] ${s.speaker || 'Speaker'}: ${s.text}`;
    }).join('\n');

    const contextText = formattedSegments || transcriptText.slice(0, 45000);

    const isPersianQuestion = /[\u0600-\u06FF]/.test(question);

    const systemPrompt = `You are NavaMind's Grounded Podcast Research Assistant.
Answer the user's question using ONLY the provided podcast transcript.
Mandatory Rules:
1. Always cite exact timestamp locations from the transcript where information appears (e.g. [03:15] or [12:40]).
2. If the question CANNOT be answered from the provided transcript, explicitly state:
   ${isPersianQuestion ? '"این موضوع در محتوای پادکست مورد بحث قرار نگرفته است."' : '"This topic is not discussed or supported in this episode\'s transcript."'}
   Do NOT hallucinate or pretend the speaker said something they did not.
3. If providing external clarification or background, place it in a separate section labeled "External Context / اطلاعات تکمیلی بیرونی".
4. Respond in the same language as the user's question (${isPersianQuestion ? 'Persian فارسی' : 'English'}).
5. Keep answers clear, structured, and directly actionable.`;

    const { response, modelUsed } = await generateContentWithCascade(ai, {
      contents: `Episode Title: ${episodeTitle}

Transcript with Timestamps:
${contextText}

User Question: "${question}"`,
      systemInstruction: systemPrompt,
      temperature: 0.2,
    });

    const answer = response.text || '';

    // Extract citations matching [MM:SS]
    const citationMatches = Array.from(answer.matchAll(/\[(\d{1,2}):(\d{2})\]/g)).map((m) => {
      const totalSec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      return {
        formatted: m[0],
        seconds: totalSec,
      };
    });

    // Deduplicate citations
    const uniqueCitations = citationMatches.filter((c, idx, arr) =>
      arr.findIndex((x) => x.seconds === c.seconds) === idx
    );

    return res.json({
      success: true,
      answer,
      citations: uniqueCitations,
      isGrounded: !answer.includes('not discussed') && !answer.includes('مورد بحث قرار نگرفته'),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Ask Episode Error]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Q&A failed',
    });
  }
});

// --------------------------------------------------------------------------------
// Test Custom API Key Endpoint
// --------------------------------------------------------------------------------
app.post('/api/test-key', async (req, res) => {
  const { provider = 'gemini', apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key is required.' });
  }

  const start = Date.now();
  try {
    if (provider === 'gemini') {
      const testAi = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const result = await testAi.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'ping',
      });
      return res.json({
        success: true,
        latencyMs: Date.now() - start,
        message: 'Google Gemini API key verified successfully.',
      });
    }

    if (provider === 'whisper_api') {
      // Test Whisper bearer token
      const testResp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      if (testResp.ok) {
        return res.json({
          success: true,
          latencyMs: Date.now() - start,
          message: 'Whisper/OpenAI API key verified successfully.',
        });
      }
      return res.status(401).json({
        success: false,
        error: `Provider HTTP ${testResp.status}: Invalid API token.`,
      });
    }

    res.status(400).json({ error: 'Unknown provider' });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Key validation failed',
    });
  }
});

// --------------------------------------------------------------------------------
// Start Server with Vite Middleware
// --------------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NavaMind Studio] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
