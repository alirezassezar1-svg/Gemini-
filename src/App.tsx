import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ImageStudioView } from './components/ImageStudioView';
import { VideoStudioView } from './components/VideoStudioView';
import { LongFormPipelineView } from './components/LongFormPipelineView';
import { ProviderSettingsView } from './components/ProviderSettingsView';
import { ModelCatalogView } from './components/ModelCatalogView';
import { ProductionQueueView } from './components/ProductionQueueView';
import { LibraryView } from './components/LibraryView';
import { DiagnosticsView } from './components/DiagnosticsView';

import { api } from './services/api';
import { storage } from './services/storage';
import {
  AssetItem,
  ModelFallbackConfig,
  ModelInfo,
  ProductionScheduleConfig,
  ProviderConfig,
  RoutingMode,
  ServerHealthResponse,
  VideoJobState,
} from './types';
import {
  Layers,
  Image as ImageIcon,
  Video,
  Film,
  FolderKanban,
  Activity,
  Clock,
  Shield,
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [serverHealth, setServerHealth] = useState<ServerHealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [routingMode, setRoutingMode] = useState<RoutingMode>('balanced');
  const [autoFallback, setAutoFallback] = useState<boolean>(true);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [jobs, setJobs] = useState<VideoJobState[]>([]);
  const [fallbackConfig, setFallbackConfig] = useState<ModelFallbackConfig>(storage.getFallbackConfig());
  const [scheduleConfig, setScheduleConfig] = useState<ProductionScheduleConfig>(storage.getScheduleConfig());

  // Image-to-Video handoff state
  const [handoffImage, setHandoffImage] = useState<string | null>(null);
  const [handoffPrompt, setHandoffPrompt] = useState<string>('');

  // Initial load
  useEffect(() => {
    refreshHealthAndProviders();
    fetchModels();
    loadLocalVault();
  }, []);

  const refreshHealthAndProviders = async () => {
    try {
      const health = await api.getHealth();
      setServerHealth(health);
      if (health.providers) {
        setProviders(health.providers);
      }
      if (health.routingMode) {
        setRoutingMode(health.routingMode);
      }
    } catch (e) {
      console.warn('Health check failed:', e);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await api.getModels();
      setModels(res.models);
    } catch (e) {
      console.warn('Failed to load dynamic models:', e);
    }
  };

  const loadLocalVault = async () => {
    try {
      const loadedAssets = await storage.getAssets();
      setAssets(loadedAssets);
      const loadedJobs = await storage.getJobs();
      setJobs(loadedJobs);
    } catch (e) {
      console.warn('Vault load error:', e);
    }
  };

  const handleUpdateRoutingMode = async (mode: RoutingMode) => {
    setRoutingMode(mode);
    await api.updateProviderConfig({ routingMode: mode });
    await refreshHealthAndProviders();
  };

  const handleUpdateAutoFallback = async (enabled: boolean) => {
    setAutoFallback(enabled);
    await api.updateProviderConfig({ autoFallback: enabled });
    await refreshHealthAndProviders();
  };

  // Callback when new image or video is created
  const handleAssetSaved = (newAsset: AssetItem) => {
    setAssets((prev) => [newAsset, ...prev.filter((a) => a.id !== newAsset.id)]);
  };

  // Image to Video workflow transition
  const handleSendToVideo = (imageUrl: string, prompt: string) => {
    setHandoffImage(imageUrl);
    setHandoffPrompt(prompt);
    setActiveTab('video');
  };

  const completedToday = assets.filter((a) => {
    const today = new Date().toDateString();
    return new Date(a.createdAt).toDateString() === today;
  }).length;

  return (
    <div className="min-h-screen bg-[#080A0F] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverHealth={serverHealth}
        activeJobsCount={jobs.filter((j) => j.status === 'submitted' || j.status === 'processing').length}
        dailyProgress={{ completed: completedToday, target: scheduleConfig.dailyTargetVideos }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 md:pb-12">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigate={setActiveTab}
            recentAssets={assets}
            activeJobs={jobs.filter((j) => j.status === 'submitted' || j.status === 'processing')}
            scheduleConfig={scheduleConfig}
            onUpdateScheduleConfig={(c) => {
              setScheduleConfig(c);
              storage.saveScheduleConfig(c);
            }}
            ffmpegAvailable={Boolean(serverHealth?.ffmpegAvailable)}
          />
        )}

        {activeTab === 'image' && (
          <ImageStudioView
            models={models}
            onImageSaved={handleAssetSaved}
            onSendToVideo={handleSendToVideo}
          />
        )}

        {activeTab === 'video' && (
          <VideoStudioView
            models={models}
            initialImage={handoffImage}
            initialPrompt={handoffPrompt}
            onVideoSaved={handleAssetSaved}
            activeJobs={jobs}
            onJobsUpdated={setJobs}
          />
        )}

        {activeTab === 'pipeline' && (
          <LongFormPipelineView
            onVideoSaved={handleAssetSaved}
            ffmpegAvailable={Boolean(serverHealth?.ffmpegAvailable)}
          />
        )}

        {activeTab === 'settings' && (
          <ProviderSettingsView
            providers={providers}
            routingMode={routingMode}
            autoFallback={autoFallback}
            onRefreshProviders={refreshHealthAndProviders}
            onUpdateRoutingMode={handleUpdateRoutingMode}
            onUpdateAutoFallback={handleUpdateAutoFallback}
          />
        )}

        {activeTab === 'models' && (
          <ModelCatalogView
            models={models}
            onRefreshModels={fetchModels}
            fallbackConfig={fallbackConfig}
            onUpdateFallbackConfig={setFallbackConfig}
          />
        )}

        {activeTab === 'queue' && (
          <ProductionQueueView
            jobs={jobs}
            onJobsUpdated={setJobs}
            scheduleConfig={scheduleConfig}
            onUpdateScheduleConfig={(c) => {
              setScheduleConfig(c);
              storage.saveScheduleConfig(c);
            }}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            assets={assets}
            onAssetsChanged={loadLocalVault}
            onSendToVideoStudio={handleSendToVideo}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView serverHealth={serverHealth} />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#080A0F]/95 backdrop-blur-md border-t border-slate-800 z-40 safe-bottom">
        <div className="grid grid-cols-5 h-14">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center space-y-0.5 ${
              activeTab === 'dashboard' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px]">Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('image')}
            className={`flex flex-col items-center justify-center space-y-0.5 ${
              activeTab === 'image' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="text-[10px]">Image</span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            className={`flex flex-col items-center justify-center space-y-0.5 ${
              activeTab === 'video' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span className="text-[10px]">Video</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center space-y-0.5 ${
              activeTab === 'settings' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="text-[10px]">Keys</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex flex-col items-center justify-center space-y-0.5 ${
              activeTab === 'library' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span className="text-[10px]">Library</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
