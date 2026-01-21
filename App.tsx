import React, { useState } from 'react';
import { VideoJob, ActiveTab, TrackedFile } from './types';
import { MangaProcessor } from './components/Generator';
import { Tracker } from './components/Tracker';

// Fix: Added React and type imports, and wrapped the parseJobs function in a default-exported App component.
// This resolves the "not a module" error in index.tsx and "Cannot find name 'VideoJob'" in App.tsx.
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('generator');
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // Fix: VideoJob type is now imported from types.ts to resolve missing name error
  const parseJobs = (data: any[][]): VideoJob[] => {
    // data lúc này là mảng các hàng từ XLSX.utils.sheet_to_json(..., {header:1})
    // Cấu trúc index: 0=ID, 1=Prompt, 2-11=Images, 12=Status, 13=VideoName, 14=TypeVideo
    return data.map((r, i) => {
      const get = (idx: number) => (r[idx] !== undefined && r[idx] !== null) ? String(r[idx]).trim() : '';
      return {
        id: get(0) || `job_${i}`,
        prompt: get(1) || '',
        imagePath: get(2),
        imagePath2: get(3),
        imagePath3: get(4),
        imagePath4: get(5),
        imagePath5: get(6),
        imagePath6: get(7),
        imagePath7: get(8),
        imagePath8: get(9),
        imagePath9: get(10),
        imagePath10: get(11),
        status: get(12) as any || '',
        videoName: get(13),
        typeVideo: get(14) || 'IMG',
        videoPath: undefined,
        lastUpdated: Date.now()
      };
    });
  };

  const handleProcessingComplete = (path: string, jobs: VideoJob[]) => {
    const fileName = path.split(/[\\/]/).pop() || 'Project';
    const newFile: TrackedFile = { name: fileName, jobs, path };
    setTrackedFiles(prev => [...prev, newFile]);
    setActiveFileIndex(trackedFiles.length);
    setActiveTab('tracker');
  };

  return (
    <div className="min-h-screen bg-tet-cream font-comic flex flex-col">
      <header className="bg-white border-b-4 border-black p-4 flex flex-col md:flex-row justify-between items-center shadow-md gap-4">
        <h1 className="text-2xl font-black text-tet-red uppercase tracking-tighter">V-MANGA STUDIO</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('generator')}
            className={`px-6 py-2 border-2 border-black font-bold uppercase transition shadow-comic ${activeTab === 'generator' ? 'bg-black text-white translate-x-1 translate-y-1 shadow-none' : 'bg-white hover:bg-gray-100'}`}
          >
            Nhập Dữ Liệu
          </button>
          <button 
            onClick={() => setActiveTab('tracker')}
            className={`px-6 py-2 border-2 border-black font-bold uppercase transition shadow-comic ${activeTab === 'tracker' ? 'bg-black text-white translate-x-1 translate-y-1 shadow-none' : 'bg-white hover:bg-gray-100'}`}
          >
            Tiến Độ Sản Xuất
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-2 md:p-6">
        {activeTab === 'generator' ? (
          <div className="animate-fade-in h-full overflow-y-auto">
             <MangaProcessor 
                onProcessingComplete={handleProcessingComplete}
                onFeedback={(f) => console.log(f)}
            />
          </div>
        ) : (
          <div className="animate-fade-in h-full">
            <Tracker 
                trackedFiles={trackedFiles}
                activeFileIndex={activeFileIndex}
                setActiveFileIndex={setActiveFileIndex}
                onOpenFile={() => {}}
                onCloseFile={(idx) => {
                  const next = trackedFiles.filter((_, i) => i !== idx);
                  setTrackedFiles(next);
                  if (activeFileIndex >= next.length) setActiveFileIndex(Math.max(0, next.length - 1));
                }}
                stats={{}}
                ffmpegFound={true}
                isCombining={false}
                onPlayVideo={(path) => console.log("Play", path)}
                onShowFolder={(path) => console.log("Show Folder", path)}
                onOpenToolFlows={() => {}}
                onSetToolFlowPath={() => {}}
                onReloadVideos={() => {}}
                onRetryStuck={() => {}}
                onRetryJob={() => {}}
                onDeleteVideo={() => {}}
                onCombine={() => {}}
                onCombineAll={() => {}}
                onLinkVideo={() => {}}
            />
          </div>
        )}
      </main>
    </div>
  );
};

// Fix: Exporting App as default to resolve module error in index.tsx
export default App;