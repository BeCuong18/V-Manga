
import React, { useState, useEffect } from 'react';
import { VideoJob, ActiveTab, TrackedFile } from './types';
import { MangaProcessor } from './components/Generator';
import { Tracker } from './components/Tracker';
import { Activation } from './components/Activation';
import { getIpcRenderer } from './utils/platform';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('generator');
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isActivated, setIsActivated] = useState(false);
  const [machineId, setMachineId] = useState('');

  const ipcRenderer = getIpcRenderer();

  useEffect(() => {
    // FIX: Đảm bảo Machine ID không bao giờ bị thay đổi nếu đã tồn tại
    let savedMid = localStorage.getItem('v_manga_machine_id');
    if (!savedMid) {
        savedMid = crypto.randomUUID();
        localStorage.setItem('v_manga_machine_id', savedMid);
    }
    setMachineId(savedMid);

    // Kiểm tra bản quyền
    const savedKey = localStorage.getItem('v_manga_license');
    if (savedKey) {
        setIsActivated(true);
    }
  }, []);

  const handleActivate = async (key: string) => {
    // Logic xác thực Key (Ví dụ: Key dài hơn 10 ký tự)
    if (key.trim().length > 10) {
      localStorage.setItem('v_manga_license', key.trim());
      setIsActivated(true);
      return true;
    }
    return false;
  };

  const handleProcessingComplete = (path: string, jobs: VideoJob[]) => {
    const fileName = path.split(/[\\/]/).pop() || 'Project';
    const newFile: TrackedFile = { name: fileName, jobs, path };
    setTrackedFiles(prev => [...prev, newFile]);
    setActiveFileIndex(trackedFiles.length);
    setActiveTab('tracker');
  };

  const handleReload = () => {
    setTrackedFiles(prev => {
      const next = [...prev];
      if (next[activeFileIndex]) {
        next[activeFileIndex].jobs = next[activeFileIndex].jobs.map(job => ({
          ...job,
          lastUpdated: Date.now()
        }));
      }
      return next;
    });
  };

  if (!isActivated) {
    return <Activation machineId={machineId} onActivate={handleActivate} />;
  }

  return (
    <div className="min-h-screen bg-tet-cream font-comic flex flex-col relative z-10">
      <header className="bg-white border-b-4 border-black p-4 flex flex-col md:flex-row justify-between items-center shadow-md gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-full opacity-5 pointer-events-none bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)]"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 border-4 border-black bg-manga-accent shadow-comic transform -rotate-3 overflow-hidden flex-shrink-0">
             <img 
               src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM8.5 15l-1.5-2L5 17h14l-3.5-4.5-2.5 3z'/%3E%3C/svg%3E"
               alt="V-Manga Logo" 
               className="w-full h-full p-2"
             />
          </div>
          <div>
            <h1 className="text-2xl font-black text-tet-red uppercase tracking-tighter drop-shadow-sm leading-none">
                V-MANGA <span className="text-black">STUDIO</span>
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Standard Edition</p>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
          <button 
            onClick={() => setActiveTab('generator')}
            className={`px-6 py-2 border-2 border-black font-bold uppercase transition shadow-comic text-xs md:text-sm ${activeTab === 'generator' ? 'bg-black text-white translate-x-1 translate-y-1 shadow-none' : 'bg-white hover:bg-manga-gray'}`}
          >
            Nhập Dữ Liệu
          </button>
          <button 
            onClick={() => setActiveTab('tracker')}
            className={`px-6 py-2 border-2 border-black font-bold uppercase transition shadow-comic text-xs md:text-sm ${activeTab === 'tracker' ? 'bg-black text-white translate-x-1 translate-y-1 shadow-none' : 'bg-white hover:bg-manga-gray'}`}
          >
            Theo Dõi Sản Xuất
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-2 md:p-6 relative">
        {activeTab === 'generator' ? (
          <div className="animate-fade-in h-full overflow-y-auto custom-scrollbar">
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
                onPlayVideo={(path) => {
                  if(ipcRenderer) ipcRenderer.invoke('open-path', path);
                }}
                onShowFolder={(p) => { if(ipcRenderer) ipcRenderer.invoke('show-item-in-folder', p); }}
                onOpenToolFlows={() => { if(ipcRenderer) ipcRenderer.invoke('run-tool'); }}
                onSetToolFlowPath={() => {}}
                onReloadVideos={handleReload}
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
      
      <footer className="bg-black text-white text-[10px] py-1 px-4 flex justify-between uppercase font-bold tracking-widest relative z-10">
        <span>V-MANGA ENTERPRISE © 2026</span>
        <span className="text-manga-accent">Standard Workflow Mode</span>
      </footer>
    </div>
  );
};

export default App;
