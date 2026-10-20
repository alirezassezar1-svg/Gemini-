import React, { useState } from 'react';
import {
  Sparkles,
  Video,
  Image as ImageIcon,
  Film,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { AssetItem, ProductionScheduleConfig, VideoJobState } from '../types';
import { ActiveTab } from './Header';

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
  recentAssets: AssetItem[];
  activeJobs: VideoJobState[];
  scheduleConfig: ProductionScheduleConfig;
  onUpdateScheduleConfig: (config: ProductionScheduleConfig) => void;
  ffmpegAvailable: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  recentAssets,
  activeJobs,
  scheduleConfig,
  onUpdateScheduleConfig,
  ffmpegAvailable,
}) => {
  const [editingConfig, setEditingConfig] = useState(false);
  const [targetVideos, setTargetVideos] = useState(scheduleConfig.dailyTargetVideos);
  const [targetMinutes, setTargetMinutes] = useState(scheduleConfig.targetMinutesPerVideo);
  const [clipSeconds, setClipSeconds] = useState(scheduleConfig.clipDurationSec);
  const [concurrency, setConcurrency] = useState(scheduleConfig.concurrencyLimit);

  // Math calculations for production feasibility
  const totalDailyMinutes = targetVideos * targetMinutes;
  const totalDailySeconds = totalDailyMinutes * 60;
  const clipsPerVideo = Math.ceil((targetMinutes * 60) / (clipSeconds || 6));
  const totalClipsRequired = targetVideos * clipsPerVideo;
  const estimatedGenerationHours = (totalClipsRequired * 45) / 3600; // ~45s per Veo generation
  const concurrencyNeededFor24h = Math.ceil(estimatedGenerationHours / 24);
  const estimatedStorageGb = Math.round((totalClipsRequired * 15) / 1024); // ~15MB per 1080p clip

  // Completed count today
  const completedToday = recentAssets.filter((a) => {
    const today = new Date().toDateString();
    return new Date(a.createdAt).toDateString() === today;
  }).length;

  const handleSaveConfig = () => {
    const updated: ProductionScheduleConfig = {
      ...scheduleConfig,
      dailyTargetVideos: targetVideos,
      targetMinutesPerVideo: targetMinutes,
      clipDurationSec: clipSeconds,
      concurrencyLimit: concurrency,
    };
    onUpdateScheduleConfig(updated);
    setEditingConfig(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#0D1527] to-[#111827] border border-slate-800/80 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">
            <span>Production Executive Control</span>
            <span className="text-slate-600">·</span>
            <span>Multi-Model AI Studio</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
            Automated High-Volume Image & Video Generation
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-300 leading-relaxed">
            Directly orchestrates real Google Gemini 3.8 and Google Veo models with automated model routing,
            dynamic catalog discovery, TTS narration synthesis, and FFmpeg timeline assembly.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('pipeline')}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-cyan-600/20 cursor-pointer"
            >
              <Film className="w-4 h-4" />
              <span>Launch 30m Pipeline</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => onNavigate('video')}
              className="inline-flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              <Video className="w-4 h-4 text-cyan-400" />
              <span>Generate Veo Clip</span>
            </button>

            <button
              onClick={() => onNavigate('image')}
              className="inline-flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-purple-400" />
              <span>Generate Image</span>
            </button>
          </div>
        </div>
      </div>

      {/* Production KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Target Card */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Daily Production Target</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-white">{completedToday}</span>
            <span className="text-sm font-mono text-slate-400">/ {scheduleConfig.dailyTargetVideos} vids</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {scheduleConfig.targetMinutesPerVideo} mins each ({totalDailyMinutes} total mins/day)
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((completedToday / (scheduleConfig.dailyTargetVideos || 1)) * 100))}%` }}
            />
          </div>
        </div>

        {/* Required Clips Card */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Clips Needed Per Day</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-cyan-400">{totalClipsRequired.toLocaleString()}</span>
            <span className="text-xs text-slate-400">clips/day</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {clipsPerVideo} clips/video @ {scheduleConfig.clipDurationSec}s Veo length
          </div>
        </div>

        {/* Compute Load Card */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Estimated Generation Compute</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-purple-300">{Math.round(estimatedGenerationHours)}</span>
            <span className="text-xs text-slate-400">compute hrs/day</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Min. {concurrencyNeededFor24h} concurrent workers for 24h completion
          </div>
        </div>

        {/* Pipeline & FFmpeg Status */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-medium">Assembly Engine</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-center space-x-2">
            {ffmpegAvailable ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-base font-bold text-white">FFmpeg 4.4.2</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-base font-bold text-amber-300">Client Canvas</span>
              </>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {ffmpegAvailable ? 'Native server-side long-form concatenation ready' : 'Browser video stitching active'}
          </div>
        </div>
      </div>

      {/* Production Target & Feasibility Reality Matrix */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight">30x30m Long-Form Production Feasibility Matrix</h2>
              <span className="text-xs bg-blue-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40">
                Verified Reality Check
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Engineering breakdown of requirements, API rate limits, and scheduling strategy to produce 30 videos of 30 minutes daily.
            </p>
          </div>

          <button
            onClick={() => setEditingConfig(!editingConfig)}
            className="self-start md:self-auto inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{editingConfig ? 'Cancel Edit' : 'Adjust Targets'}</span>
          </button>
        </div>

        {/* Configuration Edit Panel */}
        {editingConfig && (
          <div className="mt-4 p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300">Target Videos Per Day</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={targetVideos}
                  onChange={(e) => setTargetVideos(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Target Minutes Per Video</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Clip Length (Seconds)</label>
                <input
                  type="number"
                  min="4"
                  max="15"
                  value={clipSeconds}
                  onChange={(e) => setClipSeconds(parseInt(e.target.value) || 6)}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Concurrency Workers</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value) || 2)}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
              >
                Apply Production Target
              </button>
            </div>
          </div>
        )}

        {/* Matrix Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <span>01. Production Math</span>
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li className="flex justify-between">
                <span>Total Output:</span>
                <span className="font-mono text-white">{totalDailyMinutes} minutes ({totalDailySeconds.toLocaleString()}s)</span>
              </li>
              <li className="flex justify-between">
                <span>Clips per 30m film:</span>
                <span className="font-mono text-white">{clipsPerVideo} clips</span>
              </li>
              <li className="flex justify-between">
                <span>Total Daily Clips:</span>
                <span className="font-mono text-cyan-400 font-semibold">{totalClipsRequired.toLocaleString()} clips</span>
              </li>
              <li className="flex justify-between">
                <span>Estimated Bandwidth:</span>
                <span className="font-mono text-white">~{estimatedStorageGb} GB / day</span>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <span>02. Quota & Concurrency Reality</span>
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li className="flex justify-between">
                <span>Veo Avg Latency:</span>
                <span className="font-mono text-white">40s - 60s per clip</span>
              </li>
              <li className="flex justify-between">
                <span>Sequential Runtime:</span>
                <span className="font-mono text-white">{Math.round(estimatedGenerationHours)} hours (1 stream)</span>
              </li>
              <li className="flex justify-between">
                <span>Required Concurrency:</span>
                <span className="font-mono text-cyan-400 font-semibold">{concurrencyNeededFor24h} parallel workers</span>
              </li>
              <li className="flex justify-between">
                <span>Rate Limit Backoff:</span>
                <span className="font-mono text-emerald-400">Exponential retry enabled</span>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <span>03. Practical Pipeline Strategy</span>
            </h3>
            <div className="mt-3 text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                A single API call cannot produce a 30-minute video. Apex Studio operates a multi-stage pipeline:
              </p>
              <div className="text-[11px] text-slate-400 pl-2 border-l border-cyan-800/60 space-y-1">
                <div>1. Script & storyboard generation via <strong className="text-slate-200">Gemini 3.8 Flash</strong></div>
                <div>2. Clip-by-clip generation queue via <strong className="text-slate-200">Veo 3.1</strong></div>
                <div>3. 24kHz audio narration via <strong className="text-slate-200">Gemini TTS</strong></div>
                <div>4. Stitching & muxing via native <strong className="text-slate-200">FFmpeg 4.4</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Jobs & Recent Library Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Production Queue */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white">Active Production Jobs</h3>
              {activeJobs.length > 0 && (
                <span className="text-xs bg-cyan-950/80 text-cyan-300 px-2 py-0.2 rounded border border-cyan-800">
                  {activeJobs.length} in progress
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('queue')}
              className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center space-x-1"
            >
              <span>Manage Queue</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {activeJobs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <span>No active jobs currently in flight. Ready to queue next batch.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 mt-2 max-h-60 overflow-y-auto">
              {activeJobs.map((job) => (
                <div key={job.jobId} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="max-w-[70%]">
                    <div className="font-medium text-slate-200 truncate">{job.prompt}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {job.model} · {job.resolution} · {job.aspectRatio}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-cyan-400 uppercase">{job.status}</span>
                    <div className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Assets Gallery Preview */}
        <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">Recent Studio Assets</h3>
            <button
              onClick={() => onNavigate('library')}
              className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center space-x-1"
            >
              <span>View Library</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentAssets.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <span>Library is empty. Generate your first image or video to begin.</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-3 max-h-60 overflow-y-auto">
              {recentAssets.slice(0, 8).map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => onNavigate('library')}
                  className="group relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 cursor-pointer"
                >
                  {asset.type === 'image' && asset.dataUrl ? (
                    <img
                      src={asset.dataUrl}
                      alt={asset.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition group-hover:scale-105"
                    />
                  ) : asset.type === 'video' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-2 text-center">
                      <Play className="w-5 h-5 text-cyan-400 mb-1" />
                      <span className="text-[9px] text-slate-400 truncate w-full">{asset.title}</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-[10px]">
                      Audio
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
