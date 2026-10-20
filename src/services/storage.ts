import { AssetItem, VideoJobState, LongFormProject, ModelFallbackConfig, ProductionScheduleConfig } from '../types';

const DB_NAME = 'ApexStudioDB';
const DB_VERSION = 1;

const DEFAULT_FALLBACK_CONFIG: ModelFallbackConfig = {
  imagePriority: ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1', 'gemini-3-pro-image'],
  videoPriority: ['veo-3.1-lite-generate-preview', 'veo-3.1-generate-preview'],
  textPriority: ['gemini-3.8-flash', 'gemini-3.1-pro-preview'],
  ttsPriority: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'],
  maxRetries: 3,
  backoffMultiplier: 2,
  initialBackoffMs: 1500,
  autoFallbackEnabled: true,
};

const DEFAULT_SCHEDULE_CONFIG: ProductionScheduleConfig = {
  dailyTargetVideos: 30,
  targetMinutesPerVideo: 30,
  clipDurationSec: 6,
  concurrencyLimit: 2,
  autoStartQueue: true,
  pauseOnQuotaExhaustion: true,
  activeHoursStart: 0,
  activeHoursEnd: 24,
  enableServerScheduler: true,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('jobs')) {
        db.createObjectStore('jobs', { keyPath: 'jobId' });
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const storage = {
  // Assets
  async saveAsset(asset: AssetItem): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        const store = tx.objectStore('assets');
        store.put(asset);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // LocalStorage fallback
      const list = storage.getFallbackList('apex_assets');
      const idx = list.findIndex((a: any) => a.id === asset.id);
      if (idx >= 0) list[idx] = asset;
      else list.unshift(asset);
      localStorage.setItem('apex_assets', JSON.stringify(list));
    }
  },

  async getAssets(): Promise<AssetItem[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readonly');
        const store = tx.objectStore('assets');
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result || [];
          res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          resolve(res);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return storage.getFallbackList('apex_assets');
    }
  },

  async deleteAsset(id: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        const store = tx.objectStore('assets');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const list = storage.getFallbackList('apex_assets').filter((a: any) => a.id !== id);
      localStorage.setItem('apex_assets', JSON.stringify(list));
    }
  },

  // Jobs
  async saveJob(job: VideoJobState): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('jobs', 'readwrite');
        const store = tx.objectStore('jobs');
        store.put(job);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const list = storage.getFallbackList('apex_jobs');
      const idx = list.findIndex((j: any) => j.jobId === job.jobId);
      if (idx >= 0) list[idx] = job;
      else list.unshift(job);
      localStorage.setItem('apex_jobs', JSON.stringify(list));
    }
  },

  async getJobs(): Promise<VideoJobState[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('jobs', 'readonly');
        const store = tx.objectStore('jobs');
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result || [];
          res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          resolve(res);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return storage.getFallbackList('apex_jobs');
    }
  },

  async deleteJob(jobId: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('jobs', 'readwrite');
        const store = tx.objectStore('jobs');
        store.delete(jobId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const list = storage.getFallbackList('apex_jobs').filter((j: any) => j.jobId !== jobId);
      localStorage.setItem('apex_jobs', JSON.stringify(list));
    }
  },

  // Projects
  async saveProject(project: LongFormProject): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        store.put(project);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const list = storage.getFallbackList('apex_projects');
      const idx = list.findIndex((p: any) => p.id === project.id);
      if (idx >= 0) list[idx] = project;
      else list.unshift(project);
      localStorage.setItem('apex_projects', JSON.stringify(list));
    }
  },

  async getProjects(): Promise<LongFormProject[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result || [];
          res.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          resolve(res);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return storage.getFallbackList('apex_projects');
    }
  },

  async deleteProject(id: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const list = storage.getFallbackList('apex_projects').filter((p: any) => p.id !== id);
      localStorage.setItem('apex_projects', JSON.stringify(list));
    }
  },

  // Settings
  getFallbackConfig(): ModelFallbackConfig {
    try {
      const saved = localStorage.getItem('apex_fallback_config');
      return saved ? JSON.parse(saved) : DEFAULT_FALLBACK_CONFIG;
    } catch {
      return DEFAULT_FALLBACK_CONFIG;
    }
  },

  saveFallbackConfig(config: ModelFallbackConfig): void {
    localStorage.setItem('apex_fallback_config', JSON.stringify(config));
  },

  getScheduleConfig(): ProductionScheduleConfig {
    try {
      const saved = localStorage.getItem('apex_schedule_config');
      return saved ? JSON.parse(saved) : DEFAULT_SCHEDULE_CONFIG;
    } catch {
      return DEFAULT_SCHEDULE_CONFIG;
    }
  },

  saveScheduleConfig(config: ProductionScheduleConfig): void {
    localStorage.setItem('apex_schedule_config', JSON.stringify(config));
  },

  // Storage Quota Estimation
  async getStorageEstimate(): Promise<{ usageMb: number; quotaMb: number; percentUsed: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageMb = Math.round((est.usage || 0) / (1024 * 1024));
        const quotaMb = Math.round((est.quota || 1024 * 1024 * 1024) / (1024 * 1024));
        const percentUsed = Math.min(100, Math.round((usageMb / (quotaMb || 1)) * 100));
        return { usageMb, quotaMb, percentUsed };
      } catch {}
    }
    return { usageMb: 12, quotaMb: 2048, percentUsed: 1 };
  },

  // Backup Export
  async exportBackup(): Promise<string> {
    const assets = await storage.getAssets();
    const jobs = await storage.getJobs();
    const projects = await storage.getProjects();
    const fallbackConfig = storage.getFallbackConfig();
    const scheduleConfig = storage.getScheduleConfig();

    return JSON.stringify(
      {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        assets,
        jobs,
        projects,
        fallbackConfig,
        scheduleConfig,
      },
      null,
      2
    );
  },

  // Backup Import
  async importBackup(jsonString: string): Promise<{ assetsCount: number; jobsCount: number; projectsCount: number }> {
    const data = JSON.parse(jsonString);
    let assetsCount = 0;
    let jobsCount = 0;
    let projectsCount = 0;

    if (Array.isArray(data.assets)) {
      for (const a of data.assets) {
        await storage.saveAsset(a);
        assetsCount++;
      }
    }
    if (Array.isArray(data.jobs)) {
      for (const j of data.jobs) {
        await storage.saveJob(j);
        jobsCount++;
      }
    }
    if (Array.isArray(data.projects)) {
      for (const p of data.projects) {
        await storage.saveProject(p);
        projectsCount++;
      }
    }
    if (data.fallbackConfig) storage.saveFallbackConfig(data.fallbackConfig);
    if (data.scheduleConfig) storage.saveScheduleConfig(data.scheduleConfig);

    return { assetsCount, jobsCount, projectsCount };
  },

  // Helper
  getFallbackList(key: string): any[] {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  },
};
