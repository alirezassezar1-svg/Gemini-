import React, { useState } from 'react';
import {
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Zap,
  RefreshCw,
  Sliders,
  Lock,
  ExternalLink,
  Clock,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import { ProviderConfig, RoutingMode } from '../types';

interface ProviderSettingsViewProps {
  providers: ProviderConfig[];
  routingMode: RoutingMode;
  autoFallback: boolean;
  onRefreshProviders: () => Promise<void>;
  onUpdateRoutingMode: (mode: RoutingMode) => Promise<void>;
  onUpdateAutoFallback: (enabled: boolean) => Promise<void>;
}

export const ProviderSettingsView: React.FC<ProviderSettingsViewProps> = ({
  providers,
  routingMode,
  autoFallback,
  onRefreshProviders,
  onUpdateRoutingMode,
  onUpdateAutoFallback,
}) => {
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<Record<string, boolean>>({});
  const [testingProvider, setTestingProvider] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [saveNotices, setSaveNotices] = useState<Record<string, string>>({});

  const handleKeyChange = (providerId: string, val: string) => {
    setKeyInputs((prev) => ({ ...prev, [providerId]: val }));
  };

  const handleSaveKey = async (providerId: string) => {
    const keyVal = keyInputs[providerId];
    if (typeof keyVal !== 'string') return;

    setSavingKey((prev) => ({ ...prev, [providerId]: true }));
    try {
      const res = await api.setProviderKey(providerId, keyVal);
      setSaveNotices((prev) => ({ ...prev, [providerId]: 'Key saved securely on server.' }));
      setKeyInputs((prev) => ({ ...prev, [providerId]: '' }));
      await onRefreshProviders();
      setTimeout(() => {
        setSaveNotices((prev) => ({ ...prev, [providerId]: '' }));
      }, 3000);
    } catch (err: any) {
      alert(`Failed to save key: ${err.message}`);
    } finally {
      setSavingKey((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingProvider((prev) => ({ ...prev, [providerId]: true }));
    setTestResults((prev) => ({ ...prev, [providerId]: undefined as any }));

    try {
      const res = await api.testProvider(providerId);
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: res.success,
          message: res.message || (res.success ? 'Connection verified successfully.' : 'Connection test failed.'),
        },
      }));
      await onRefreshProviders();
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: false,
          message: err.message || 'Connection test error',
        },
      }));
    } finally {
      setTestingProvider((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Provider Cascade & Secrets Management</h2>
              <span className="text-xs bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40">
                Multi-Provider Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configure independent generation providers, manage API keys server-side, and choose routing modes to prevent single-point failures.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRefreshProviders()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Refresh Provider Status</span>
            </button>
          </div>
        </div>

        {/* Security & Zero Quota Transparent Explanation */}
        <div className="mt-4 p-3.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 space-y-2">
          <div className="flex items-center space-x-2 font-semibold text-white">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>Secure Architecture & Free Tier Quota Reality</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            <strong>Why Gemini Image & Veo models return HTTP 429:</strong> On Google AI Studio free tier projects, Google assigns
            a daily request quota of <code className="text-cyan-400 font-mono">0</code> for image & video generation models.
            Our Multi-Provider Cascade guarantees continuous generation by immediately routing to <strong>Pollinations.ai</strong> (Flux/Turbo)
            and the <strong>FFmpeg Motion Synth Engine</strong> so production never halts.
          </p>
          <div className="text-[11px] text-slate-400 flex items-center space-x-1">
            <span className="text-emerald-400 font-semibold">Protected Secrets:</span>
            <span>API keys are stored exclusively in the server environment and never exposed in browser bundles or client code.</span>
          </div>
        </div>

        {/* Routing Mode Selector (Section 5) */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Cascade Routing Preference</h3>
              <p className="text-xs text-slate-400">Controls how the orchestrator selects providers for generation requests.</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Auto-Fallback:</span>
              <button
                onClick={() => onUpdateAutoFallback(!autoFallback)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  autoFallback ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    autoFallback ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'free' as RoutingMode,
                title: 'Free Mode (Zero Cost)',
                desc: 'Strictly invokes providers with confirmed free tier access (Pollinations Flux & FFmpeg Motion Synth). Never incurs billing.',
                badge: '100% Free',
              },
              {
                id: 'balanced' as RoutingMode,
                title: 'Balanced Mode (Recommended)',
                desc: 'Prioritizes free access first, then cascades to configured authorized providers when needed with exponential backoff.',
                badge: 'Smart Balance',
              },
              {
                id: 'reliability' as RoutingMode,
                title: 'Reliability Mode',
                desc: 'Prioritizes highest quality authorized models (Gemini/Veo/HF), falling back to free alternatives on rate limits.',
                badge: 'Max Fidelity',
              },
            ].map((mode) => (
              <div
                key={mode.id}
                onClick={() => onUpdateRoutingMode(mode.id)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  routingMode === mode.id
                    ? 'bg-blue-950/40 border-cyan-500 shadow-md shadow-cyan-950/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{mode.title}</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      {mode.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{mode.desc}</p>
                </div>
                {routingMode === mode.id && (
                  <div className="mt-3 text-[10px] text-cyan-300 font-semibold flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Active Routing Engine</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white tracking-tight">Configured Provider Adapters</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p) => {
            const hasKey = p.hasKey;
            const testResult = testResults[p.id];
            const isTesting = testingProvider[p.id];
            const isSaving = savingKey[p.id];

            return (
              <div
                key={p.id}
                className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
              >
                <div>
                  {/* Provider Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">{p.name}</span>
                        {p.supportsFree && (
                          <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800/40 font-mono">
                            Free Tier
                          </span>
                        )}
                        {!p.requiresKey && (
                          <span className="text-[10px] bg-blue-950/80 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800/40 font-mono">
                            Zero-Key
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.description}</p>
                    </div>

                    <div className="shrink-0">
                      {p.status === 'operational' && (
                        <span className="text-[11px] text-emerald-400 flex items-center space-x-1 font-mono font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ready</span>
                        </span>
                      )}
                      {p.status === 'cooldown' && (
                        <span className="text-[11px] text-amber-400 flex items-center space-x-1 font-mono font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Cooldown</span>
                        </span>
                      )}
                      {p.status === 'auth_error' && (
                        <span className="text-[11px] text-rose-400 flex items-center space-x-1 font-mono font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Auth Error</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cooldown / Error details */}
                  {p.lastErrorMessage && (
                    <div className="mt-2 text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-800/30 truncate">
                      Notice: {p.lastErrorMessage}
                    </div>
                  )}

                  {/* Latency benchmark */}
                  {p.latencyMs && (
                    <div className="mt-1 text-[10px] font-mono text-slate-500">
                      Last tested latency: {p.latencyMs}ms
                    </div>
                  )}

                  {/* Key Management Form */}
                  {p.requiresKey && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">API Secret Key</span>
                        {hasKey ? (
                          <span className="text-[11px] text-emerald-400 font-mono">
                            Configured ({p.keyMasked})
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">Not Set</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={keyInputs[p.id] || ''}
                          onChange={(e) => handleKeyChange(p.id, e.target.value)}
                          placeholder={hasKey ? 'Enter new key to replace...' : 'Paste API Key / Token...'}
                          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                        />
                        <button
                          onClick={() => handleSaveKey(p.id)}
                          disabled={isSaving || !keyInputs[p.id]?.trim()}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>

                      {saveNotices[p.id] && (
                        <div className="text-[11px] text-emerald-400 font-mono">{saveNotices[p.id]}</div>
                      )}
                    </div>
                  )}

                  {/* Test Result Feedback */}
                  {testResult && (
                    <div
                      className={`mt-2 p-2 rounded text-[11px] font-mono ${
                        testResult.success
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                          : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 font-mono">
                    Outputs: {p.supportsImage ? 'Image ' : ''}{p.supportsVideo ? 'Video' : ''}
                  </div>

                  <button
                    onClick={() => handleTestConnection(p.id)}
                    disabled={isTesting}
                    className="inline-flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 cursor-pointer font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
