import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Upload,
  X,
  Download,
  Video,
  Layers,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ChevronDown,
  Info,
  Shield,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { AssetItem, GeneratedImageOutput, ModelInfo, ProviderId, RoutingMode } from '../types';

interface ImageStudioViewProps {
  models: ModelInfo[];
  onImageSaved: (asset: AssetItem) => void;
  onSendToVideo: (imageUrl: string, prompt: string) => void;
}

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({
  models,
  onImageSaved,
  onSendToVideo,
}) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'auto'>('auto');
  const [selectedModel, setSelectedModel] = useState('flux');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '1:4' | '4:1'>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [stylePreset, setStylePreset] = useState('Cinematic');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorAttempts, setErrorAttempts] = useState<any[]>([]);

  const [currentOutput, setCurrentOutput] = useState<GeneratedImageOutput | null>(null);

  // Style presets
  const styleOptions = [
    'None',
    'Cinematic',
    'Photorealistic 8K',
    'Cyberpunk Neon',
    '3D Octane Render',
    'Architectural Digest',
    'Studio Portrait Lighting',
    'Drone Aerial Landscape',
    'Anime & Concept Art',
  ];

  // Handle prompt enhancement
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const res = await api.enhancePrompt(prompt, stylePreset, 'image');
      setPrompt(res.enhancedPrompt);
    } catch (err: any) {
      console.warn('Enhance failed:', err);
    } finally {
      setEnhancing(false);
    }
  };

  // Handle reference image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Reference image must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Generate image via multi-provider cascade
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorAttempts([]);

    const fullPrompt = stylePreset !== 'None' ? `${prompt}, style: ${stylePreset}` : prompt;

    try {
      const res = await api.generateImage({
        prompt: fullPrompt,
        negativePrompt: negativePrompt || undefined,
        provider: selectedProvider !== 'auto' ? selectedProvider : undefined,
        model: selectedModel,
        aspectRatio,
        imageSize,
        referenceImage: referenceImage || undefined,
      });

      const output: GeneratedImageOutput = {
        id: `img_${Date.now()}`,
        imageUrl: res.imageUrl,
        prompt: res.prompt,
        providerUsed: res.providerUsed,
        modelUsed: res.modelUsed,
        aspectRatio: res.aspectRatio,
        imageSize: res.imageSize,
        createdAt: new Date().toISOString(),
        attempts: res.attempts,
        durationMs: res.totalDurationMs,
      };

      setCurrentOutput(output);

      // Save to IndexedDB asset library
      const asset: AssetItem = {
        id: output.id,
        type: 'image',
        title: prompt.slice(0, 40) + '...',
        prompt: res.prompt,
        provider: res.providerUsed,
        model: res.modelUsed,
        createdAt: output.createdAt,
        aspectRatio: res.aspectRatio,
        resolution: res.imageSize || '1K',
        dataUrl: res.imageUrl,
        metadata: {
          attempts: res.attempts,
          durationMs: res.totalDurationMs,
          style: stylePreset,
        },
      };

      await storage.saveAsset(asset);
      onImageSaved(asset);
    } catch (err: any) {
      setErrorMsg(err.message || 'Image generation failed across providers');
      setErrorAttempts(err.attempts || []);
    } finally {
      setGenerating(false);
    }
  };

  // Download Image
  const handleDownload = () => {
    if (!currentOutput) return;
    const a = document.createElement('a');
    a.href = currentOutput.imageUrl;
    a.download = `apex_${currentOutput.id}.png`;
    a.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
      {/* Left Control Panel */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Image Generation Studio</h2>
              <p className="text-xs text-slate-400 mt-0.5">Multi-Provider Cascade Engine</p>
            </div>
            <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 flex items-center space-x-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Cascade Active</span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Prompt Input */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Prompt Description</span>
                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  disabled={enhancing || !prompt.trim()}
                  className="text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 flex items-center space-x-1 cursor-pointer transition text-[11px]"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>{enhancing ? 'Enhancing...' : 'Enhance with Gemini 3.8'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your scene in rich visual detail..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Negative Prompt (Optional)</label>
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="blurry, distorted, watermark, low quality, oversaturated..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Provider Adapter Selector */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Generation Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setSelectedProvider(val);
                  if (val === 'pollinations') setSelectedModel('flux');
                  if (val === 'gemini') setSelectedModel('gemini-3.1-flash-lite-image');
                  if (val === 'huggingface') setSelectedModel('black-forest-labs/FLUX.1-schnell');
                }}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="auto">Auto Multi-Provider Cascade (Zero-Downtime Fallback)</option>
                <option value="pollinations">Pollinations.ai (100% Free FLUX.1 / Turbo)</option>
                <option value="gemini">Google Gemini (Flash Lite / Nano Banana)</option>
                <option value="huggingface">Hugging Face (Serverless FLUX.1-schnell)</option>
              </select>
            </div>

            {/* Reference Image Dropzone */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Reference Image (Image-to-Image / Edit)</span>
                {referenceImage && (
                  <button
                    onClick={() => setReferenceImage(null)}
                    className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center space-x-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {referenceImage ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-cyan-500/40 bg-slate-950">
                  <img
                    src={referenceImage}
                    alt="Reference"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 text-[10px] text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    Conditioning Active
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-3.5 border border-dashed border-slate-700 hover:border-cyan-500/60 rounded-lg cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition group">
                  <Upload className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition" />
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 mt-1">Upload reference image (PNG, JPG)</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Aspect Ratio Selector */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Aspect Ratio</span>
                <span className="text-[11px] text-slate-400 font-mono">{aspectRatio}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {(['1:1', '16:9', '9:16', '4:3', '3:4', '1:4', '4:1'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer ${
                      aspectRatio === ratio
                        ? 'bg-cyan-500 text-black shadow-sm font-bold'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Aesthetic Style Preset */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Visual Aesthetic Preset</label>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {styleOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-800 disabled:to-slate-800 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Executing Cascade Router...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Generate Image</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Canvas & Output Inspector */}
      <div className="lg:col-span-7 space-y-6">
        {/* Error / Quota Notice Banner */}
        {errorMsg && (
          <div className="bg-rose-950/30 border border-rose-800/80 rounded-xl p-5 text-rose-200 space-y-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-bold text-white">All Cascade Providers Failed</div>
                <div className="text-xs text-rose-300 leading-relaxed">{errorMsg}</div>
              </div>
            </div>

            {errorAttempts.length > 0 && (
              <div className="pt-2 border-t border-rose-900/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-rose-300 uppercase">Provider Cascade Trail:</div>
                {errorAttempts.map((att, i) => (
                  <div key={i} className="text-[11px] font-mono flex items-center justify-between bg-black/30 px-2 py-1 rounded">
                    <span>{i + 1}. {att.provider} ({att.model})</span>
                    <span className="text-rose-400 font-semibold">{att.status} ({att.durationMs}ms)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live Image Canvas Preview */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6 flex flex-col items-center justify-center min-h-[460px] relative">
          {currentOutput ? (
            <div className="w-full space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black flex items-center justify-center max-h-[500px]">
                <img
                  src={currentOutput.imageUrl}
                  alt={currentOutput.prompt}
                  referrerPolicy="no-referrer"
                  className="max-h-[500px] w-auto object-contain mx-auto"
                />
              </div>

              {/* Asset Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div className="text-xs text-slate-400 space-x-2">
                  <span className="font-mono text-cyan-400 font-semibold uppercase">{currentOutput.providerUsed}</span>
                  <span className="text-slate-600">·</span>
                  <span className="font-mono text-slate-300">{currentOutput.modelUsed}</span>
                  <span className="text-slate-600">·</span>
                  <span>{currentOutput.aspectRatio}</span>
                  <span className="text-slate-600">·</span>
                  <span>{currentOutput.durationMs}ms</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    onClick={() => onSendToVideo(currentOutput.imageUrl, currentOutput.prompt)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white transition cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Animate in Video Studio</span>
                  </button>
                </div>
              </div>

              {/* Cascade Attempt Trail on Success */}
              {currentOutput.attempts && currentOutput.attempts.length > 0 && (
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-300 flex items-center justify-between">
                    <span>Intelligent Cascade Routing Audit:</span>
                    <span className="text-[11px] text-emerald-400 font-mono">Resolved via {currentOutput.providerUsed}</span>
                  </div>
                  {currentOutput.attempts.map((att, i) => (
                    <div key={i} className="flex justify-between font-mono text-[11px] text-slate-400 bg-black/20 px-2 py-1 rounded">
                      <span>{i + 1}. {att.provider || 'primary'} ({att.model})</span>
                      <span className={att.status === 'success' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                        {att.status.toUpperCase()} {att.errorCode ? `(HTTP ${att.errorCode})` : ''} - {att.durationMs}ms
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-500 space-y-3">
              <ImageIcon className="w-16 h-16 mx-auto text-slate-700" />
              <div className="text-sm font-medium text-slate-400">Multi-Provider Image Canvas Ready</div>
              <p className="text-xs text-slate-600 max-w-sm">
                Enter a visual prompt. The Cascade Orchestrator automatically routes through available providers with instant zero-quota fallback.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
