import React, { useState } from 'react';
import {
  Film,
  Sparkles,
  Wand2,
  Play,
  Volume2,
  Layers,
  Clock,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Video,
  ListOrdered,
  FileText,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { AssetItem, LongFormProject, StoryboardScene } from '../types';

interface LongFormPipelineViewProps {
  onVideoSaved: (asset: AssetItem) => void;
  ffmpegAvailable: boolean;
}

export const LongFormPipelineView: React.FC<LongFormPipelineViewProps> = ({
  onVideoSaved,
  ffmpegAvailable,
}) => {
  const [topic, setTopic] = useState('');
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(5);
  const [visualStyle, setVisualStyle] = useState('Cinematic 4K Documentary');
  const [tone, setTone] = useState('Engaging & Authoritative');
  const [scenesCount, setScenesCount] = useState(5);

  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [currentProject, setCurrentProject] = useState<LongFormProject | null>(null);
  const [feasibility, setFeasibility] = useState<any | null>(null);

  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [generatingTtsForScene, setGeneratingTtsForScene] = useState<string | null>(null);
  const [generatingClipForScene, setGeneratingClipForScene] = useState<string | null>(null);
  const [renderingFinalVideo, setRenderingFinalVideo] = useState(false);
  const [renderedResult, setRenderedResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generate Storyboard using Gemini 3.8 Flash structured JSON
  const handleGenerateStoryboard = async () => {
    if (!topic.trim()) return;
    setGeneratingStoryboard(true);
    setErrorMessage(null);
    setRenderedResult(null);

    try {
      const res = await api.generateStoryboard({
        topic,
        targetDurationMinutes,
        visualStyle,
        tone,
        scenesCount,
      });

      const newProj: LongFormProject = {
        id: `proj_${Date.now()}`,
        title: res.projectTitle,
        topic,
        targetDurationMinutes,
        totalClipsEstimated: res.scenes.length,
        scenes: res.scenes,
        status: 'storyboarding',
        renderLog: [`Storyboard generated with ${res.scenes.length} scenes.`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCurrentProject(newProj);
      setFeasibility(res.feasibilityReport);
      await storage.saveProject(newProj);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create storyboard');
    } finally {
      setGeneratingStoryboard(false);
    }
  };

  // Generate TTS Narration for a scene
  const handleGenerateSceneTts = async (scene: StoryboardScene) => {
    if (!currentProject || !scene.narrationScript) return;
    setGeneratingTtsForScene(scene.id);

    try {
      const res = await api.generateTts(scene.narrationScript, scene.voiceName || 'Kore');

      const updatedScenes = currentProject.scenes.map((s) => {
        if (s.id === scene.id) {
          return {
            ...s,
            clipAudioUrl: res.audioUrl,
            audioDurationSec: Math.round(res.sizeBytes / 48000), // ~48kB/s for 24kHz 16-bit mono
          };
        }
        return s;
      });

      const updatedProj: LongFormProject = {
        ...currentProject,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      };

      setCurrentProject(updatedProj);
      await storage.saveProject(updatedProj);
    } catch (err: any) {
      alert(`TTS error for scene ${scene.sceneNumber}: ${err.message}`);
    } finally {
      setGeneratingTtsForScene(null);
    }
  };

  // Generate Video Clip for a scene
  const handleGenerateSceneClip = async (scene: StoryboardScene) => {
    if (!currentProject) return;
    setGeneratingClipForScene(scene.id);

    try {
      const res = await api.generateVideo({
        prompt: scene.visualPrompt,
        model: 'veo-3.1-lite-generate-preview',
        aspectRatio: '16:9',
        resolution: '720p',
      });

      // Update scene status to generating
      const updatedScenes = currentProject.scenes.map((s) => {
        if (s.id === scene.id) {
          return {
            ...s,
            clipStatus: 'generating' as const,
            clipJobId: res.jobId,
          };
        }
        return s;
      });

      const updatedProj: LongFormProject = {
        ...currentProject,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      };

      setCurrentProject(updatedProj);
      await storage.saveProject(updatedProj);

      // Poll until ready
      const checkPoll = async () => {
        try {
          const poll = await api.pollVideoStatus(res.operationName, res.jobId);
          if (poll.done) {
            let videoUrl = poll.videoUri || '';
            try {
              const dl = await api.downloadVideo(res.operationName, res.jobId);
              videoUrl = dl.downloadUrl;
            } catch {}

            const finalizedScenes = currentProject.scenes.map((s) => {
              if (s.id === scene.id) {
                return {
                  ...s,
                  clipStatus: poll.error ? ('failed' as const) : ('ready' as const),
                  clipVideoUrl: videoUrl,
                  errorMessage: poll.error?.message,
                };
              }
              return s;
            });

            const finProj: LongFormProject = {
              ...currentProject,
              scenes: finalizedScenes,
              updatedAt: new Date().toISOString(),
            };
            setCurrentProject(finProj);
            await storage.saveProject(finProj);
            setGeneratingClipForScene(null);
          } else {
            setTimeout(checkPoll, 7000);
          }
        } catch {
          setGeneratingClipForScene(null);
        }
      };

      setTimeout(checkPoll, 7000);
    } catch (err: any) {
      alert(`Video clip creation error: ${err.message}`);
      setGeneratingClipForScene(null);
    }
  };

  // Render complete long-form master video with FFmpeg
  const handleRenderMasterVideo = async () => {
    if (!currentProject || currentProject.scenes.length === 0) return;
    setRenderingFinalVideo(true);
    setErrorMessage(null);

    try {
      const clipsPayload = currentProject.scenes.map((s) => ({
        clipUrl: s.clipVideoUrl || '',
        durationSec: s.durationSeconds || 6,
        narrationUrl: s.clipAudioUrl || undefined,
        subtitleText: s.narrationScript,
      }));

      const res = await api.renderVideo({
        projectId: currentProject.id,
        title: currentProject.title,
        clips: clipsPayload,
      });

      setRenderedResult(res);

      const finalProj: LongFormProject = {
        ...currentProject,
        renderedVideoUrl: res.videoUrl,
        renderedVideoDuration: res.durationSeconds,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      };

      setCurrentProject(finalProj);
      await storage.saveProject(finalProj);

      // Save to asset library
      const asset: AssetItem = {
        id: currentProject.id,
        type: 'project',
        title: currentProject.title,
        prompt: currentProject.topic,
        model: 'Gemini 3.8 + Veo 3.1 + FFmpeg',
        createdAt: new Date().toISOString(),
        dataUrl: res.videoUrl,
        metadata: {
          scenesCount: currentProject.scenes.length,
          durationSeconds: res.durationSeconds,
          filename: res.filename,
        },
      };
      await storage.saveAsset(asset);
      onVideoSaved(asset);
    } catch (err: any) {
      setErrorMessage(err.message || 'Render failed');
    } finally {
      setRenderingFinalVideo(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Title & Pipeline Header */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Film className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Long-Form Video Production Pipeline</h2>
              <span className="text-xs bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40">
                30x30m Automated Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Transforms creative briefs into multi-scene scripts, synthesized 24kHz voiceovers, Veo video clips, and stitches them with FFmpeg.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Renderer:</span>
            <span className={`font-mono font-medium ${ffmpegAvailable ? 'text-emerald-400' : 'text-amber-400'}`}>
              {ffmpegAvailable ? 'FFmpeg 4.4.2 Server' : 'Client-Side Canvas'}
            </span>
          </div>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5">
          <div className="md:col-span-6">
            <label className="text-xs font-medium text-slate-300 mb-1 block">Production Brief / Topic</label>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The Deep Ocean: Uncharted Abyssal Ecosystems & Hydrothermal Vents..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-300 mb-1 block">Target Film Duration</label>
            <select
              value={targetDurationMinutes}
              onChange={(e) => setTargetDurationMinutes(parseInt(e.target.value) || 5)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value={2}>2 Minutes (Preview Short)</option>
              <option value={5}>5 Minutes (Mini Documentary)</option>
              <option value={15}>15 Minutes (Featurette)</option>
              <option value={30}>30 Minutes (Full Production Target)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-300 mb-1 block">Scene Beats</label>
            <select
              value={scenesCount}
              onChange={(e) => setScenesCount(parseInt(e.target.value) || 5)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value={4}>4 Key Scenes</option>
              <option value={6}>6 Detailed Scenes</option>
              <option value={8}>8 Extended Scenes</option>
              <option value={10}>10 Epic Chapter Scenes</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleGenerateStoryboard}
            disabled={generatingStoryboard || !topic.trim()}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-800 disabled:to-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-cyan-600/20 cursor-pointer disabled:cursor-not-allowed"
          >
            {generatingStoryboard ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Architecting Storyboard with Gemini 3.8...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Generate Storyboard & Script</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-950/30 border border-rose-800/80 rounded-xl p-4 text-rose-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Feasibility Alert Note */}
      {feasibility && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="text-slate-300">
            <span className="font-semibold text-white">Daily 30x30m Target Projection:</span> Requires{' '}
            <span className="font-mono text-cyan-400">{feasibility.dailyClipsRequired.toLocaleString()} clips/day</span> across{' '}
            <span className="font-mono text-cyan-400">{feasibility.concurrencyRequired} parallel workers</span>.
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Est. Bandwidth: ~{feasibility.bandwidthEstGb} GB / day
          </span>
        </div>
      )}

      {/* Storyboard Scenes Grid */}
      {currentProject && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{currentProject.title}</h3>
              <p className="text-xs text-slate-400">
                {currentProject.scenes.length} Scenes · Target: {currentProject.targetDurationMinutes} Minutes
              </p>
            </div>

            <button
              onClick={handleRenderMasterVideo}
              disabled={renderingFinalVideo}
              className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-md cursor-pointer disabled:cursor-not-allowed"
            >
              {renderingFinalVideo ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Stitching Timeline with FFmpeg...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-white" />
                  <span>Assemble Master Film (FFmpeg)</span>
                </>
              )}
            </button>
          </div>

          {/* Render Result Card */}
          {renderedResult && (
            <div className="bg-[#0F131D] border border-emerald-500/40 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-400 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Master Film Successfully Assembled</span>
                </div>
                <a
                  href={renderedResult.videoUrl}
                  download={renderedResult.filename}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Master MP4</span>
                </a>
              </div>

              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                <video src={renderedResult.videoUrl} controls className="w-full h-full object-contain" />
              </div>

              <div className="text-xs text-slate-400 flex items-center space-x-3 font-mono">
                <span>{renderedResult.clipsAssembled} scenes stitched</span>
                <span>·</span>
                <span>{renderedResult.durationSeconds}s duration</span>
                <span>·</span>
                <span>{(renderedResult.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            </div>
          )}

          {/* Scenes Cards */}
          <div className="space-y-4">
            {currentProject.scenes.map((scene, idx) => (
              <div
                key={scene.id}
                className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-5 hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/60">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                      Scene {scene.sceneNumber}
                    </span>
                    <span className="text-sm font-bold text-white">{scene.title}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {scene.durationSeconds}s · Voice: {scene.voiceName} · Camera: {scene.cameraDirection || 'Cinematic'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Visual Prompt for Veo */}
                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Visual Sequence (Veo Prompt)
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{scene.visualPrompt}</p>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <span className="text-[11px] font-mono text-slate-400">
                        Clip: {scene.clipStatus.toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleGenerateSceneClip(scene)}
                        disabled={generatingClipForScene === scene.id || scene.clipStatus === 'generating'}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1 cursor-pointer disabled:text-slate-600"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>
                          {generatingClipForScene === scene.id ? 'Generating Clip...' : 'Generate Clip (Veo)'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Narration Script for TTS */}
                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Voiceover Script (Gemini TTS)
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed italic">&ldquo;{scene.narrationScript}&rdquo;</p>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                      {scene.clipAudioUrl ? (
                        <audio src={scene.clipAudioUrl} controls className="h-7 w-40" />
                      ) : (
                        <span className="text-[11px] font-mono text-slate-500">Audio: None</span>
                      )}

                      <button
                        onClick={() => handleGenerateSceneTts(scene)}
                        disabled={generatingTtsForScene === scene.id}
                        className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center space-x-1 cursor-pointer disabled:text-slate-600"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>
                          {generatingTtsForScene === scene.id ? 'Synthesizing...' : 'Synthesize Voiceover'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
