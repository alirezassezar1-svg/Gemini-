export type ModelCategory = 'image' | 'video' | 'text' | 'tts' | 'audio';
export type ProviderId = 'gemini' | 'pollinations' | 'huggingface' | 'replicate' | 'fal' | 'motion_synth';
export type RoutingMode = 'free' | 'balanced' | 'reliability';

export interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ModelCategory;
  provider: ProviderId;
  supportedActions: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportsReferenceImage: boolean;
  supportedAspectRatios: string[];
  supportedResolutions: string[];
  requiresPaidKey: boolean;
  status: 'active' | 'rate_limited' | 'quota_exhausted' | 'unavailable';
  lastTested?: string;
  rateLimitDetails?: string;
}

export interface FallbackAttempt {
  provider?: ProviderId;
  model: string;
  status: 'success' | 'failed';
  errorCode?: number | string;
  errorMessage?: string;
  timestamp: string;
  durationMs: number;
  isQuotaError?: boolean;
  retryDelay?: number;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  description: string;
  enabled: boolean;
  hasKey: boolean;
  keyMasked?: string;
  requiresKey: boolean;
  supportsFree: boolean;
  supportsImage: boolean;
  supportsVideo: boolean;
  status: 'operational' | 'cooldown' | 'auth_error' | 'disabled';
  cooldownUntil?: string | null;
  lastTested?: string;
  latencyMs?: number;
  lastErrorMessage?: string;
}

export interface CascadeSettings {
  routingMode: RoutingMode;
  autoFallback: boolean;
  maxRetries: number;
  timeoutSeconds: number;
  providerPriority: ProviderId[];
  imageModelPriority: string[];
  videoModelPriority: string[];
}

export interface ModelFallbackConfig {
  imagePriority: string[];
  videoPriority: string[];
  textPriority: string[];
  ttsPriority: string[];
  maxRetries: number;
  backoffMultiplier: number;
  initialBackoffMs: number;
  autoFallbackEnabled: boolean;
  routingMode?: RoutingMode;
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  provider?: ProviderId;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '1:4' | '4:1';
  imageSize?: '1K' | '2K' | '4K';
  style?: string;
  referenceImage?: string; // Base64
  numberOfOutputs?: number;
  routingMode?: RoutingMode;
}

export interface GeneratedImageOutput {
  id: string;
  imageUrl: string;
  prompt: string;
  providerUsed: ProviderId;
  modelUsed: string;
  aspectRatio: string;
  imageSize?: string;
  createdAt: string;
  attempts: FallbackAttempt[];
  durationMs: number;
}

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  provider?: ProviderId;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p' | '4k';
  startingImage?: string; // Base64
  lastFrame?: string; // Base64
  referenceImages?: string[]; // Up to 3
  extendVideoUri?: string;
  routingMode?: RoutingMode;
}

export interface VideoJobState {
  jobId: string;
  operationName: string;
  prompt: string;
  providerUsed: ProviderId;
  model: string;
  videoType: 'neural_veo' | 'neural_provider' | 'camera_motion_synth';
  status: 'queued' | 'submitted' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  aspectRatio: string;
  resolution: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
  videoBlobUrl?: string;
  durationSec?: number;
  error?: string;
  attempts: FallbackAttempt[];
  quotaRetryDelay?: number;
  hasStartingImage?: boolean;
}

export interface StoryboardScene {
  id: string;
  sceneNumber: number;
  title: string;
  summary: string;
  durationSeconds: number;
  visualPrompt: string;
  narrationScript: string;
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  cameraDirection: string;
  transition: 'cut' | 'fade' | 'dissolve' | 'wipe';
  clipStatus: 'pending' | 'generating' | 'ready' | 'failed';
  clipVideoUrl?: string;
  clipAudioUrl?: string;
  audioDurationSec?: number;
  clipJobId?: string;
  clipProvider?: ProviderId;
  videoType?: 'neural_veo' | 'neural_provider' | 'camera_motion_synth';
  errorMessage?: string;
}

export interface LongFormProject {
  id: string;
  title: string;
  topic: string;
  targetDurationMinutes: number;
  totalClipsEstimated: number;
  scenes: StoryboardScene[];
  renderedVideoUrl?: string;
  renderedVideoDuration?: number;
  status: 'draft' | 'storyboarding' | 'generating_clips' | 'assembling' | 'completed' | 'failed';
  renderProgress?: number;
  renderLog: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductionScheduleConfig {
  dailyTargetVideos: number;
  targetMinutesPerVideo: number;
  clipDurationSec: number;
  concurrencyLimit: number;
  autoStartQueue: boolean;
  pauseOnQuotaExhaustion: boolean;
  activeHoursStart: number;
  activeHoursEnd: number;
  enableServerScheduler: boolean;
}

export interface AssetItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'project';
  title: string;
  prompt: string;
  provider?: ProviderId;
  model: string;
  createdAt: string;
  aspectRatio?: string;
  resolution?: string;
  dataUrl?: string;
  sizeBytes?: number;
  metadata?: Record<string, any>;
}

export interface DiagnosticTestResult {
  id: string;
  name: string;
  description: string;
  category: 'api' | 'fallback' | 'ffmpeg' | 'queue' | 'tts' | 'multiprovider';
  status: 'idle' | 'running' | 'passed' | 'failed' | 'warning';
  durationMs: number;
  details: string;
  error?: string;
  timestamp?: string;
}

export interface ServerHealthResponse {
  status: string;
  hasGeminiKey: boolean;
  keyLength: number;
  ffmpegAvailable: boolean;
  ffmpegVersion?: string;
  timestamp: string;
  nodeVersion: string;
  platform: string;
  activeJobsCount: number;
  providers: ProviderConfig[];
  routingMode: RoutingMode;
}
