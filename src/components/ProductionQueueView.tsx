import React, { useState } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Server,
  Layers,
  Activity,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ProductionScheduleConfig, VideoJobState } from '../types';
import { storage } from '../services/storage';

interface ProductionQueueViewProps {
  jobs: VideoJobState[];
  onJobsUpdated: (jobs: VideoJobState[]) => void;
  scheduleConfig: ProductionScheduleConfig;
  onUpdateScheduleConfig: (config: ProductionScheduleConfig) => void;
}

export const ProductionQueueView: React.FC<ProductionQueueViewProps> = ({
  jobs,
  onJobsUpdated,
  scheduleConfig,
  onUpdateScheduleConfig,
}) => {
  const [queuePaused, setQueuePaused] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredJobs = jobs.filter((j) => {
    if (filterStatus === 'all') return true;
    return j.status === filterStatus;
  });

  const activeCount = jobs.filter((j) => j.status === 'submitted' || j.status === 'processing').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  // Clear completed jobs
  const handleClearCompleted = async () => {
    const toDelete = jobs.filter((j) => j.status === 'completed');
    for (const j of toDelete) {
      await storage.deleteJob(j.jobId);
    }
    const updated = await storage.getJobs();
    onJobsUpdated(updated);
  };

  // Retry failed jobs
  const handleRetryFailed = async () => {
    const toRetry = jobs.filter((j) => j.status === 'failed');
    for (const j of toRetry) {
      const reset: VideoJobState = {
        ...j,
        status: 'queued',
        error: undefined,
        updatedAt: new Date().toISOString(),
      };
      await storage.saveJob(reset);
    }
    const updated = await storage.getJobs();
    onJobsUpdated(updated);
  };

  // Delete single job
  const handleDeleteJob = async (jobId: string) => {
    await storage.deleteJob(jobId);
    const updated = await storage.getJobs();
    onJobsUpdated(updated);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Controls */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Production Queue & Automated Scheduler</h2>
              <span className="text-xs bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40">
                Persistent State Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manages background job states, concurrency throttles, and automated recovery across page reloads.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setQueuePaused(!queuePaused)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                queuePaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600/90 hover:bg-amber-500 text-white'
              }`}
            >
              {queuePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{queuePaused ? 'Resume Scheduler' : 'Pause Scheduler'}</span>
            </button>

            {failedCount > 0 && (
              <button
                onClick={handleRetryFailed}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Failed ({failedCount})</span>
              </button>
            )}

            {completedCount > 0 && (
              <button
                onClick={handleClearCompleted}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Server-Side Runtime Boundary Explanation */}
        <div className="mt-4 p-3 bg-slate-900/70 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white">Execution Runtime Notice:</strong> Browser-only JavaScript schedulers pause when
            the tab is put to sleep or closed. Apex AI Studio stores job operations in IndexedDB and on the local Node.js server.
            For unattended 24-hour continuous production targeting 30 daily long-form videos, jobs are processed in the Node.js daemon.
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Total Jobs</div>
            <div className="text-xl font-bold font-mono text-white mt-1">{jobs.length}</div>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Active / Polling</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">{activeCount}</div>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Completed</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{completedCount}</div>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Failed / Fallback</div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-1">{failedCount}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-5">
          {['all', 'processing', 'submitted', 'completed', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase font-mono transition cursor-pointer ${
                filterStatus === st
                  ? 'bg-blue-600/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Queue Work Items</h3>
          <span className="text-xs text-slate-400 font-mono">{filteredJobs.length} items</span>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <Clock className="w-10 h-10 mx-auto text-slate-700 mb-2" />
            <span>No jobs matching the current filter in queue.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-medium border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Work Item Prompt</th>
                  <th className="py-3 px-4">Model & Format</th>
                  <th className="py-3 px-4">Status & Progress</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredJobs.map((j) => (
                  <tr key={j.jobId} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-white truncate">{j.prompt}</div>
                      <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                        ID: {j.jobId}
                      </div>
                      {j.error && (
                        <div className="text-[11px] text-rose-400 mt-1 truncate">
                          Error: {j.error}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      <div>{j.model}</div>
                      <div className="text-slate-500">{j.resolution} · {j.aspectRatio}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        {j.status === 'completed' ? (
                          <span className="text-emerald-400 font-mono font-medium uppercase">COMPLETED</span>
                        ) : j.status === 'failed' ? (
                          <span className="text-rose-400 font-mono font-medium uppercase">FAILED</span>
                        ) : (
                          <div className="flex items-center space-x-2 text-cyan-400 font-mono uppercase">
                            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                            <span>{j.status} ({j.progress || 30}%)</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(j.createdAt).toLocaleTimeString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteJob(j.jobId)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 transition cursor-pointer"
                        title="Delete from Queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
