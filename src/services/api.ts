import {
  ModelInfo,
  GeneratedImageOutput,
  VideoJobState,
  LongFormProject,
  StoryboardScene,
  DiagnosticTestResult,
  ServerHealthResponse,
  ProviderConfig,
  RoutingMode,
  ProviderId,
} from '../types';

export const api = {
  // Health
  async getHealth(): Promise<ServerHealthResponse> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  // Providers Status & Config
  async getProviders(): Promise<{
    providers: ProviderConfig[];
    routingMode: RoutingMode;
    autoFallback: boolean;
  }> {
    const res = await fetch('/api/providers');
    if (!res.ok) throw new Error(`Failed to fetch providers: ${res.statusText}`);
    return res.json();
  },

  async updateProviderConfig(params: {
    routingMode?: RoutingMode;
    autoFallback?: boolean;
    enabledProviders?: Record<string, boolean>;
  }): Promise<{ success: boolean; routingMode: RoutingMode; autoFallback: boolean }> {
    const res = await fetch('/api/providers/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Failed to update provider configuration: ${res.statusText}`);
    return res.json();
  },

  async setProviderKey(provider: string, key: string): Promise<{
    success: boolean;
    provider: string;
    hasKey: boolean;
    keyMasked?: string;
  }> {
    const res = await fetch('/api/providers/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save provider key');
    }
    return res.json();
  },

  async testProvider(provider: string): Promise<{
    success: boolean;
    provider: string;
    latencyMs?: number;
    message?: string;
    error?: string;
  }> {
    const res = await fetch('/api/providers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    return res.json();
  },

  // Dynamic Model Catalog
  async getModels(): Promise<{ models: ModelInfo[]; liveDiscoveredCount: number; timestamp: string }> {
    const res = await fetch('/api/models');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch models: ${res.statusText}`);
    }
    return res.json();
  },

  // Prompt Enhancement
  async enhancePrompt(
    prompt: string,
    style = 'Cinematic',
    targetType: 'image' | 'video' = 'image'
  ): Promise<{ originalPrompt: string; enhancedPrompt: string; modelUsed: string }> {
    const res = await fetch('/api/enhance-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style, targetType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Enhancement failed');
    }
    return res.json();
  },

  // Image Generation with Multi-Provider Cascade
  async generateImage(params: {
    prompt: string;
    negativePrompt?: string;
    model?: string;
    provider?: ProviderId;
    aspectRatio?: string;
    imageSize?: string;
    referenceImage?: string;
    routingMode?: RoutingMode;
  }): Promise<{
    success: boolean;
    imageUrl: string;
    providerUsed: ProviderId;
    modelUsed: string;
    prompt: string;
    aspectRatio: string;
    imageSize?: string;
    attempts: any[];
    totalDurationMs: number;
  }> {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const errorObj = new Error(data.error || 'Image generation failed');
      (errorObj as any).attempts = data.attempts;
      throw errorObj;
    }
    return data;
  },

  // Video Generation: Submit Multi-Provider Cascade Job
  async generateVideo(params: {
    prompt: string;
    model?: string;
    provider?: ProviderId;
    aspectRatio?: string;
    resolution?: string;
    startingImage?: string;
    lastFrame?: string;
    referenceImages?: string[];
    extendVideoUri?: string;
    routingMode?: RoutingMode;
  }): Promise<{
    success: boolean;
    jobId: string;
    operationName: string;
    providerUsed: ProviderId;
    modelUsed: string;
    videoType: 'neural_veo' | 'neural_provider' | 'camera_motion_synth';
    downloadUrl?: string;
    status: string;
    attempts: any[];
    notice?: string;
  }> {
    const res = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const errorObj = new Error(data.error || 'Video generation failed');
      (errorObj as any).attempts = data.attempts;
      throw errorObj;
    }
    return data;
  },

  // Video Generation: Poll Status
  async pollVideoStatus(operationName: string, jobId?: string): Promise<{
    operationName: string;
    done: boolean;
    error: any;
    metadata: any;
    hasVideoUri: boolean;
    videoUri: string | null;
    videoType?: string;
    downloadUrl?: string;
    status: 'submitted' | 'processing' | 'completed' | 'failed';
  }> {
    const res = await fetch('/api/video-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationName, jobId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Polling status failed');
    }
    return res.json();
  },

  // Video Download: Cache & Retrieve MP4
  async downloadVideo(operationName: string, jobId?: string): Promise<{
    success: boolean;
    downloadUrl: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
  }> {
    const res = await fetch('/api/video-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationName, jobId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Video download failed');
    }
    return res.json();
  },

  // TTS Speech Narration
  async generateTts(text: string, voice = 'Kore', style?: string): Promise<{
    success: boolean;
    audioUrl: string;
    audioDataUrl: string;
    voiceUsed: string;
    text: string;
    sizeBytes: number;
  }> {
    const res = await fetch('/api/generate-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, style }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'TTS generation failed');
    }
    return res.json();
  },

  // Long-Form Storyboard Generation
  async generateStoryboard(params: {
    topic: string;
    targetDurationMinutes?: number;
    visualStyle?: string;
    tone?: string;
    scenesCount?: number;
  }): Promise<{
    projectTitle: string;
    synopsis: string;
    targetDurationMinutes: number;
    scenes: StoryboardScene[];
    feasibilityReport: {
      targetDailyVideos: number;
      targetDurationPerVideo: number;
      clipsPerVideo: number;
      dailyClipsRequired: number;
      generationTimeEstimateHours: number;
      concurrencyRequired: number;
      bandwidthEstGb: number;
      feasibilityNote: string;
    };
  }> {
    const res = await fetch('/api/pipeline/storyboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Storyboard creation failed');
    }
    return res.json();
  },

  // FFmpeg Server-Side Render
  async renderVideo(params: {
    projectId?: string;
    title?: string;
    clips: {
      clipUrl: string;
      durationSec?: number;
      narrationUrl?: string;
      subtitleText?: string;
    }[];
  }): Promise<{
    success: boolean;
    videoUrl: string;
    filename: string;
    sizeBytes: number;
    durationSeconds: number;
    clipsAssembled: number;
  }> {
    const res = await fetch('/api/pipeline/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'FFmpeg rendering failed');
    }
    return data;
  },

  // Diagnostics Test Suite
  async runDiagnostic(testType: string): Promise<DiagnosticTestResult> {
    const res = await fetch('/api/diagnostics/run-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testType }),
    });
    return res.json();
  },
};
