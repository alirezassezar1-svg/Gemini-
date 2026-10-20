import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Play,
  Pause,
  Upload,
  Sparkles,
  Wand2,
  Download,
  RotateCcw,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  RefreshCw,
  Film,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { AssetItem, ModelInfo, ProviderId, VideoJobState } from '../types';

interface VideoStudioViewProps {
  models: ModelInfo[];
  initialImage?: string | null;
  initialPrompt?: string;
  onVideoSaved: (asset: AssetItem) => void;
  activeJobs: VideoJobState[];
  onJobsUpdated: (jobs: VideoJobState[]) => void;
}

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  models,
  initialImage,
  initialPrompt = '',
  onVideoSaved,
  activeJobs,
  onJobsUpdated,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'auto'>('auto');
  const [selectedModel, setSelectedModel] = useState('veo-3.1-lite-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('720p');
  const [startingImage, setStartingImage] = useState<string | null>(initialImage || null);
  const [lastFrame, setLastFrame] = useState<string | null>(null);

  const [enhancing, setEnhancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorAttempts, setErrorAttempts] = useState<any[]>([]);

  const [currentJob, setCurrentJob] = useState<VideoJobState | null>(null);
  const [downloading, setDownloading] = useState(false);

  const pollingTimerRef = useRef<any>(null);

  useEffect(() => {
    if (initialImage) {
      setStartingImage(initialImage);
    }
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialImage, initialPrompt]);

  // Polling active jobs
  useEffect(() => {
    const checkActiveJobs = async () => {
      const pendingJobs = activeJobs.filter((j) => j.status === 'submitted' || j.status === 'processing');
      if (pendingJobs.length === 0) return;

      for (const job of pendingJobs) {
        try {
          const pollRes = await api.pollVideoStatus(job.operationName, job.jobId);
          if (pollRes.done) {
            let updatedJob: VideoJobState;

            if (pollRes.error) {
              updatedJob = {
                ...job,
                status: 'failed',
                error: pollRes.error.message || 'Video generation failed',
                updatedAt: new Date().toISOString(),
              };
            } else {
              let downloadUrl = job.downloadUrl || '';
              if (!downloadUrl) {
                try {
                  const dl = await api.downloadVideo(job.operationName, job.jobId);
                  downloadUrl = dl.downloadUrl;
                } catch {
                  downloadUrl = pollRes.videoUri || '';
                }
              }

              updatedJob = {
                ...job,
                status: 'completed',
                progress: 100,
                downloadUrl,
                updatedAt: new Date().toISOString(),
              };

              // Save to asset library
              const asset: AssetItem = {
                id: job.jobId,
                type: 'video',
                title: job.prompt.slice(0, 45) + '...',
                prompt: job.prompt,
                provider: job.providerUsed,
                model: job.model,
                createdAt: job.createdAt,
                aspectRatio: job.aspectRatio,
                resolution: job.resolution,
                dataUrl: downloadUrl,
                metadata: {
                  operationName: job.operationName,
                  videoType: job.videoType,
                  durationSec: 6,
                },
              };
              await storage.saveAsset(asset);
              onVideoSaved(asset);
            }

            await storage.saveJob(updatedJob);
            if (currentJob?.jobId === job.jobId) {
              setCurrentJob(updatedJob);
            }
          } else {
            const updatedJob: VideoJobState = {
              ...job,
              status: 'processing',
              progress: Math.min((job.progress || 10) + 15, 90),
              updatedAt: new Date().toISOString(),
            };
            await storage.saveJob(updatedJob);
            if (currentJob?.jobId === job.jobId) {
              setCurrentJob(updatedJob);
            }
          }
        } catch (pollErr) {
          console.warn('Poll error for job:', job.jobId, pollErr);
        }
      }

      const allJobs = await storage.getJobs();
      onJobsUpdated(allJobs);
    };

    pollingTimerRef.current = setInterval(checkActiveJobs, 6000);
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [activeJobs, currentJob]);

  // Prompt enhancement
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const res = await api.enhancePrompt(prompt, 'Cinematic Hollywood', 'video');
      setPrompt(res.enhancedPrompt);
    } catch (err: any) {
      console.warn('Enhance failed:', err);
    } finally {
      setEnhancing(false);
    }
  };

  // Upload frames
  const handleUploadStartingFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStartingImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadLastFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLastFrame(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Submit video generation
  const handleSubmitVideo = async () => {
    if (!prompt.trim() && !startingImage) return;
    setSubmitting(true);
    setErrorMsg(null);
    setErrorAttempts([]);

    try {
      const res = await api.generateVideo({
        prompt,
        provider: selectedProvider !== 'auto' ? selectedProvider : undefined,
        model: selectedModel,
        aspectRatio,
        resolution,
        startingImage: startingImage || undefined,
        lastFrame: lastFrame || undefined,
      });

      const newJob: VideoJobState = {
        jobId: res.jobId,
        operationName: res.operationName,
        prompt: prompt || 'Video Clip',
        providerUsed: res.providerUsed,
        model: res.modelUsed,
        videoType: res.videoType,
        status: res.status as any,
        progress: res.status === 'completed' ? 100 : 15,
        aspectRatio,
        resolution,
        downloadUrl: res.downloadUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: res.attempts,
        hasStartingImage: Boolean(startingImage),
      };

      await storage.saveJob(newJob);
      setCurrentJob(newJob);

      if (res.status === 'completed' && res.downloadUrl) {
        const asset: AssetItem = {
          id: res.jobId,
          type: 'video',
          title: prompt.slice(0, 45) + '...',
          prompt,
          provider: res.providerUsed,
          model: res.modelUsed,
          createdAt: newJob.createdAt,
          aspectRatio,
          resolution,
          dataUrl: res.downloadUrl,
          metadata: {
            videoType: res.videoType,
            durationSec: 6,
          },
        };
        await storage.saveAsset(asset);
        onVideoSaved(asset);
      }

      const allJobs = await storage.getJobs();
      onJobsUpdated(allJobs);
    } catch (err: any) {
      setErrorMsg(err.message || 'Video generation failed across providers');
      setErrorAttempts(err.attempts || []);
    } finally {
      setSubmitting(false);
    }
  };

  // Manual download
  const handleDownloadMp4 = async (job: VideoJobState) => {
    setDownloading(true);
    try {
      if (job.downloadUrl && job.downloadUrl.startsWith('/renders/')) {
        const a = document.createElement('a');
        a.href = job.downloadUrl;
        a.download = `apex_${job.jobId}.mp4`;
        a.click();
      } else {
        const dl = await api.downloadVideo(job.operationName, job.jobId);
        const a = document.createElement('a');
        a.href = dl.downloadUrl;
        a.download = dl.filename;
        a.click();
      }
    } catch (err: any) {
      alert(`Download error: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
      {/* Left Parameters Panel */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Video Generation Studio</h2>
              <p className="text-xs text-slate-400 mt-0.5">Veo Neural Video & Motion Synthesis</p>
            </div>
            <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 flex items-center space-x-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Multi-Provider</span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Prompt Input */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Video Prompt</span>
                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  disabled={enhancing || !prompt.trim()}
                  className="text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 flex items-center space-x-1 cursor-pointer transition text-[11px]"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>{enhancing ? 'Cinematographer...' : 'Cinematize Prompt'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A high-speed cybernetic drone weaving through neon skyscraper canyons at night, camera orbiting, rain reflections..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            {/* Provider Adapter Selection */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Video Provider Engine</label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setSelectedProvider(val);
                }}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="auto">Auto Cascade (Veo with Motion Synth Fallback)</option>
                <option value="gemini">Google Veo 3.1 (Neural Video - Requires Paid Quota)</option>
                <option value="motion_synth">FFmpeg Motion Synth Engine (100% Free Guaranteed)</option>
              </select>
            </div>

            {/* Starting Frame */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Starting Frame (Keyframe Animation)</span>
                {startingImage && (
                  <button
                    onClick={() => setStartingImage(null)}
                    className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center space-x-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {startingImage ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-cyan-500/40 bg-slate-950">
                  <img
                    src={startingImage}
                    alt="Starting Frame"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 text-[10px] text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    Keyframe Active
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-3.5 border border-dashed border-slate-700 hover:border-cyan-500/60 rounded-lg cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition group">
                  <Upload className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition" />
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 mt-1">Upload First Frame</span>
                  <input type="file" accept="image/*" onChange={handleUploadStartingFrame} className="hidden" />
                </label>
              )}
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                {(['16:9', '9:16'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-2 rounded text-xs font-mono font-medium transition cursor-pointer ${
                      aspectRatio === ratio
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitVideo}
                disabled={submitting || (!prompt.trim() && !startingImage)}
                className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-800 disabled:to-slate-800 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Orchestrating Video Job...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 text-white" />
                    <span>Generate Video Clip</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Canvas / Player */}
      <div className="lg:col-span-7 space-y-6">
        {/* Error Notice */}
        {errorMsg && (
          <div className="bg-rose-950/30 border border-rose-800/80 rounded-xl p-5 text-rose-200 space-y-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-bold text-white">Video Generation Error</div>
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

        {/* Video Canvas / Player */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6 min-h-[460px] flex flex-col justify-between">
          {currentJob && currentJob.status === 'completed' && currentJob.downloadUrl ? (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black aspect-video flex items-center justify-center">
                <video
                  src={currentJob.downloadUrl}
                  controls
                  loop
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div className="text-xs text-slate-400 space-x-2 flex items-center">
                  <span className="font-mono text-cyan-400 font-semibold uppercase">{currentJob.providerUsed}</span>
                  <span className="text-slate-600">·</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    currentJob.videoType === 'neural_veo'
                      ? 'bg-blue-950 text-cyan-300 border border-cyan-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {currentJob.videoType === 'neural_veo' ? 'Neural Video (Veo)' : 'Camera-Motion Video (Free Synth)'}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>{currentJob.aspectRatio}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDownloadMp4(currentJob)}
                    disabled={downloading}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloading ? 'Downloading...' : 'Download MP4'}</span>
                  </button>
                </div>
              </div>

              {/* Cascade attempt audit */}
              {currentJob.attempts && currentJob.attempts.length > 0 && (
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-slate-300">Routing Audit Trail:</div>
                  {currentJob.attempts.map((att, i) => (
                    <div key={i} className="flex justify-between font-mono text-[11px] text-slate-400">
                      <span>{att.provider} ({att.model})</span>
                      <span className={att.status === 'success' ? 'text-emerald-400' : 'text-amber-400'}>
                        {att.status.toUpperCase()} {att.errorCode ? `(HTTP ${att.errorCode})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentJob && (currentJob.status === 'submitted' || currentJob.status === 'processing') ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative w-16 h-16">
                <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-cyan-400 animate-spin" />
                <Video className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Rendering Video Clip</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Video frames are being processed by {currentJob.providerUsed || 'Google Veo'}. Progress is polled automatically.
                </p>
              </div>

              <div className="w-64 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-700"
                  style={{ width: `${currentJob.progress || 30}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-500 space-y-3">
              <Video className="w-16 h-16 mx-auto text-slate-700" />
              <div className="text-sm font-medium text-slate-400">Video Canvas Monitor Ready</div>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Generate neural video clips or camera-motion sequences. The cascade automatically routes around quota limits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
