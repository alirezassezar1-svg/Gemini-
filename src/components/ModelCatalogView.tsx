import React, { useState } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Layers,
  ArrowUpDown,
  Lock,
  ExternalLink,
  ShieldAlert,
  Clock,
  Zap,
} from 'lucide-react';
import { ModelFallbackConfig, ModelInfo } from '../types';
import { storage } from '../services/storage';

interface ModelCatalogViewProps {
  models: ModelInfo[];
  onRefreshModels: () => Promise<void>;
  fallbackConfig: ModelFallbackConfig;
  onUpdateFallbackConfig: (config: ModelFallbackConfig) => void;
}

export const ModelCatalogView: React.FC<ModelCatalogViewProps> = ({
  models,
  onRefreshModels,
  fallbackConfig,
  onUpdateFallbackConfig,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(15); // minutes
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable fallback priorities
  const [imagePriority, setImagePriority] = useState<string[]>(
    fallbackConfig.imagePriority || ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1', 'gemini-3-pro-image']
  );
  const [videoPriority, setVideoPriority] = useState<string[]>(
    fallbackConfig.videoPriority || ['veo-3.1-lite-generate-preview', 'veo-3.1-generate-preview']
  );
  const [maxRetries, setMaxRetries] = useState(fallbackConfig.maxRetries || 3);
  const [backoffMultiplier, setBackoffMultiplier] = useState(fallbackConfig.backoffMultiplier || 2);
  const [initialBackoffMs, setInitialBackoffMs] = useState(fallbackConfig.initialBackoffMs || 1500);

  const filteredModels = models.filter((m) => {
    if (filterCategory === 'all') return true;
    return m.category === filterCategory;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshModels();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveConfig = () => {
    const updated: ModelFallbackConfig = {
      ...fallbackConfig,
      imagePriority,
      videoPriority,
      maxRetries,
      backoffMultiplier,
      initialBackoffMs,
      autoFallbackEnabled: true,
    };
    onUpdateFallbackConfig(updated);
    storage.saveFallbackConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Reordering helpers
  const moveItem = (list: string[], fromIndex: number, toIndex: number) => {
    const updated = [...list];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Catalog Header */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Real Model Catalog & Dynamic Discovery</h2>
              <span className="text-xs bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40">
                Official Google GenAI SDK
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live models discovered dynamically through <span className="font-mono text-slate-300">ai.models.list()</span>.
              Categorized with real token limits, supported modalities, and billing tiers.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Auto-refresh:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value={5}>5 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
              </select>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Probing API...' : 'Refresh Catalog'}</span>
            </button>
          </div>
        </div>

        {/* Quota Transparency Notice */}
        <div className="mt-4 p-3 bg-blue-950/30 border border-blue-900/60 rounded-lg text-xs text-slate-300 flex items-start space-x-2.5">
          <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white">API Quota Boundary Notice:</strong> Google Gemini API model discovery exposes model schemas,
            capabilities, and supported action methods, but does not publish real-time remaining quota counters over the REST catalog.
            Quota exhaustion is detected at execution time (HTTP 429 RESOURCE_EXHAUSTED), which triggers our automatic fallback router.
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mt-5">
          {[
            { id: 'all', label: 'All Models' },
            { id: 'image', label: 'Image Generation' },
            { id: 'video', label: 'Video Generation (Veo)' },
            { id: 'text', label: 'Script & Storyboard' },
            { id: 'tts', label: 'Speech & Narration' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                filterCategory === cat.id
                  ? 'bg-blue-600/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Discovered Models Table */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Discovered Models Matrix</h3>
          <span className="text-xs text-slate-400 font-mono">{filteredModels.length} models active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Model & Identifier</th>
                <th className="py-3 px-4">Modality</th>
                <th className="py-3 px-4">Supported Capabilities</th>
                <th className="py-3 px-4">Resolutions / Aspect</th>
                <th className="py-3 px-4">Billing Requirement</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredModels.map((m) => (
                <tr key={m.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{m.displayName}</div>
                    <div className="font-mono text-[11px] text-cyan-400 mt-0.5">{m.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1 max-w-sm">{m.description}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-mono uppercase text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {m.category}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 space-y-1 text-slate-300">
                    <div className="flex items-center space-x-1.5">
                      <span>Ref Image:</span>
                      <span className={m.supportsReferenceImage ? 'text-emerald-400' : 'text-slate-500'}>
                        {m.supportsReferenceImage ? 'Supported' : 'No'}
                      </span>
                    </div>
                    {m.inputTokenLimit && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        Tokens: {(m.inputTokenLimit / 1000).toFixed(0)}K
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                    <div>{m.supportedResolutions.join(', ') || 'N/A'}</div>
                    <div className="text-slate-500">{m.supportedAspectRatios.join(', ') || 'Standard'}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    {m.requiresPaidKey ? (
                      <span className="text-[11px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 font-medium">
                        Paid Tier / Quota
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 font-medium">
                        Standard Key
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Operational</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fallback & Routing Configurator */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Intelligent Fallback Order & Routing Rules</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure automatic model transition order when primary model encounters 429 quota exhaustion or rate limits.
            </p>
          </div>

          <button
            onClick={handleSaveConfig}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer shadow-md"
          >
            {saveSuccess ? 'Saved Successfully!' : 'Save Routing Rules'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image Fallback Sequence */}
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Image Model Fallback Sequence</span>
              <span className="text-[10px] text-cyan-400 font-mono">Top = Highest Priority</span>
            </div>
            <div className="space-y-2">
              {imagePriority.map((modId, idx) => (
                <div
                  key={modId}
                  className="flex items-center justify-between p-2.5 bg-slate-950/80 rounded border border-slate-800 text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-400">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-slate-200">{modId}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {idx > 0 && (
                      <button
                        onClick={() => setImagePriority(moveItem(imagePriority, idx, idx - 1))}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        title="Move Up"
                      >
                        ▲
                      </button>
                    )}
                    {idx < imagePriority.length - 1 && (
                      <button
                        onClick={() => setImagePriority(moveItem(imagePriority, idx, idx + 1))}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        title="Move Down"
                      >
                        ▼
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Video Fallback Sequence */}
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Video Model Fallback Sequence</span>
              <span className="text-[10px] text-cyan-400 font-mono">Top = Highest Priority</span>
            </div>
            <div className="space-y-2">
              {videoPriority.map((modId, idx) => (
                <div
                  key={modId}
                  className="flex items-center justify-between p-2.5 bg-slate-950/80 rounded border border-slate-800 text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-400">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-slate-200">{modId}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {idx > 0 && (
                      <button
                        onClick={() => setVideoPriority(moveItem(videoPriority, idx, idx - 1))}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        title="Move Up"
                      >
                        ▲
                      </button>
                    )}
                    {idx < videoPriority.length - 1 && (
                      <button
                        onClick={() => setVideoPriority(moveItem(videoPriority, idx, idx + 1))}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        title="Move Down"
                      >
                        ▼
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Retry & Backoff Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Max Retry Attempts</label>
            <input
              type="number"
              min="1"
              max="5"
              value={maxRetries}
              onChange={(e) => setMaxRetries(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Initial Backoff Delay (ms)</label>
            <input
              type="number"
              min="500"
              max="5000"
              step="500"
              value={initialBackoffMs}
              onChange={(e) => setInitialBackoffMs(parseInt(e.target.value) || 1000)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Exponential Multiplier</label>
            <input
              type="number"
              min="1.5"
              max="4"
              step="0.5"
              value={backoffMultiplier}
              onChange={(e) => setBackoffMultiplier(parseFloat(e.target.value) || 2)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
