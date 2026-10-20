import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Search,
  Download,
  Trash2,
  Image as ImageIcon,
  Video,
  Film,
  Volume2,
  FileJson,
  Upload,
  HardDrive,
  ExternalLink,
  Layers,
  X,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { AssetItem } from '../types';
import { storage } from '../services/storage';

interface LibraryViewProps {
  assets: AssetItem[];
  onAssetsChanged: () => void;
  onSendToVideoStudio: (imageUrl: string, prompt: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  assets,
  onAssetsChanged,
  onSendToVideoStudio,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [storageEstimate, setStorageEstimate] = useState<{ usageMb: number; quotaMb: number; percentUsed: number }>({
    usageMb: 5,
    quotaMb: 2048,
    percentUsed: 1,
  });

  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);

  useEffect(() => {
    storage.getStorageEstimate().then(setStorageEstimate);
  }, [assets]);

  const filteredAssets = assets.filter((a) => {
    const matchesType = filterType === 'all' || a.type === filterType;
    const matchesSearch =
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.prompt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.model?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Export full JSON backup
  const handleExportBackup = async () => {
    const jsonStr = await storage.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex_studio_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupSuccess('Studio backup exported successfully!');
    setTimeout(() => setBackupSuccess(null), 3000);
  };

  // Import JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const res = await storage.importBackup(text);
        onAssetsChanged();
        setBackupSuccess(`Imported ${res.assetsCount} assets and ${res.jobsCount} jobs.`);
        setTimeout(() => setBackupSuccess(null), 4000);
      } catch (err: any) {
        alert(`Backup import error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Delete single asset
  const handleDelete = async (id: string) => {
    await storage.deleteAsset(id);
    if (selectedAsset?.id === id) setSelectedAsset(null);
    onAssetsChanged();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Storage Quota */}
      <div className="bg-[#0F131D] border border-slate-800/80 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <FolderKanban className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">IndexedDB Asset Library & Storage</h2>
              <span className="text-xs bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40">
                Local Persistent Vault
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Locally persisted images, video clips, master renders, and TTS narration audio tracks.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportBackup}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Studio Backup</span>
            </button>

            <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Backup</span>
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {backupSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{backupSuccess}</span>
          </div>
        )}

        {/* Storage Bar & Disclaimer */}
        <div className="mt-4 p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-slate-300">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <span>Browser IndexedDB Storage Utilization:</span>
              <span className="font-mono text-white font-bold">{storageEstimate.usageMb} MB</span>
              <span className="text-slate-500">/ ~{storageEstimate.quotaMb} MB</span>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">{storageEstimate.percentUsed}% Allocated</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all"
              style={{ width: `${Math.max(1, storageEstimate.percentUsed)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed pt-1">
            <strong className="text-slate-300">Storage Persistence Truth:</strong> Video files saved to the server cache
            are stored in <code className="text-cyan-400">/public/renders</code>. Remote Google CDN URLs expire after a short duration;
            our server copies videos locally to prevent broken assets.
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt, model, or title..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex gap-1.5 w-full sm:w-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'image', label: 'Images' },
              { id: 'video', label: 'Videos' },
              { id: 'project', label: 'Master Films' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  filterType === type.id
                    ? 'bg-blue-600/30 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Asset Cards Grid */}
      {filteredAssets.length === 0 ? (
        <div className="py-20 text-center text-slate-500 bg-[#0F131D] border border-slate-800 rounded-xl">
          <FolderKanban className="w-12 h-12 mx-auto text-slate-700 mb-2" />
          <div className="text-sm font-medium text-slate-400">No assets found in library</div>
          <p className="text-xs text-slate-600 mt-1">Generated images, video clips, and assembled films will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelectedAsset(asset)}
              className="group bg-[#0F131D] border border-slate-800/80 hover:border-slate-700 rounded-xl overflow-hidden shadow-lg transition flex flex-col cursor-pointer"
            >
              {/* Media Preview Box */}
              <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                {asset.type === 'image' && asset.dataUrl ? (
                  <img
                    src={asset.dataUrl}
                    alt={asset.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition group-hover:scale-105"
                  />
                ) : asset.type === 'video' || asset.type === 'project' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-2 text-center">
                    <Play className="w-8 h-8 text-cyan-400 mb-1" />
                    <span className="text-[10px] text-slate-400 truncate w-full px-2">{asset.title}</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-xs">
                    <Volume2 className="w-6 h-6 text-purple-400" />
                  </div>
                )}

                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded border border-slate-700/60 uppercase">
                  {asset.type}
                </div>
              </div>

              {/* Metadata Details */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition">
                    {asset.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {asset.prompt}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span className="truncate max-w-[120px]">{asset.model}</span>
                  <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Inspector Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F131D] border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono uppercase bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                {selectedAsset.type}
              </span>
              <h3 className="text-base font-bold text-white truncate max-w-md">{selectedAsset.title}</h3>
            </div>

            {/* Media Presentation */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {selectedAsset.type === 'image' && selectedAsset.dataUrl ? (
                <img
                  src={selectedAsset.dataUrl}
                  alt={selectedAsset.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              ) : selectedAsset.dataUrl ? (
                <video src={selectedAsset.dataUrl} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                <div className="text-slate-500 text-xs">Media source unavailable</div>
              )}
            </div>

            {/* Prompt & Specs */}
            <div className="space-y-2 text-xs">
              <div className="text-slate-400 font-semibold uppercase text-[10px]">Generation Prompt:</div>
              <p className="text-slate-200 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed font-sans">
                {selectedAsset.prompt}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Model:</span>
                <span className="font-mono text-white text-[11px] truncate block">{selectedAsset.model}</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Aspect Ratio:</span>
                <span className="font-mono text-white text-[11px] block">{selectedAsset.aspectRatio || '16:9'}</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Resolution:</span>
                <span className="font-mono text-white text-[11px] block">{selectedAsset.resolution || 'Standard'}</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Created:</span>
                <span className="font-mono text-white text-[11px] block">
                  {new Date(selectedAsset.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => handleDelete(selectedAsset.id)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Asset</span>
              </button>

              <div className="flex items-center space-x-2">
                {selectedAsset.type === 'image' && selectedAsset.dataUrl && (
                  <button
                    onClick={() => {
                      onSendToVideoStudio(selectedAsset.dataUrl!, selectedAsset.prompt);
                      setSelectedAsset(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white transition cursor-pointer"
                  >
                    Animate in Video Studio
                  </button>
                )}

                {selectedAsset.dataUrl && (
                  <a
                    href={selectedAsset.dataUrl}
                    download={`apex_${selectedAsset.id}.${selectedAsset.type === 'image' ? 'png' : 'mp4'}`}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
