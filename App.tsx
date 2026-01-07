import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { TrackedFile, VideoJob } from './types';
import { MangaProcessor } from './components/Generator';
import { Tracker } from './components/Tracker';
import { Activation } from './components/Activation';
import { AlertModal } from './components/AppModals';
import { isElectron, getIpcRenderer } from './utils/platform';
import { LoaderIcon } from './components/Icons';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'generator' | 'tracker'>('generator');
    const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
    const [activeTrackerFileIndex, setActiveTrackerFileIndex] = useState(0);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info', message: string } | null>(null);
    const [ffmpegFound, setFfmpegFound] = useState<boolean | null>(null);

    // Update States
    const [updateDownloaded, setUpdateDownloaded] = useState(false);

    // Activation State
    const [isActivated, setIsActivated] = useState(false);
    const [machineId, setMachineId] = useState('');
    const [checkingActivation, setCheckingActivation] = useState(true);

    // Refs for Web File Opening
    const webOpenFileRef = useRef<HTMLInputElement>(null);

    const isDesktop = isElectron();
    const ipcRenderer = getIpcRenderer();

    const trackedFilesRef = useRef<TrackedFile[]>([]);
    useEffect(() => { trackedFilesRef.current = trackedFiles; }, [trackedFiles]);

    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => {
                setFeedback(null);
            }, 5000); 
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    // Check Activation on Mount & Setup Update Listeners
    useEffect(() => {
        const check = async () => {
            if (isDesktop && ipcRenderer) {
                try {
                    // Get Machine ID
                    const idRes = await ipcRenderer.invoke('get-machine-id');
                    setMachineId(idRes.machineId);

                    // Check if activated
                    const statusRes = await ipcRenderer.invoke('check-activation');
                    setIsActivated(statusRes.activated);

                    // Listen for updates
                    ipcRenderer.on('update-message', (_: any, data: any) => {
                        console.log('Update msg:', data);
                        if (data.type === 'checking') {
                            setFeedback({ type: 'info', message: 'Đang kiểm tra bản cập nhật...' });
                        } else if (data.type === 'available') {
                            setFeedback({ type: 'success', message: 'Đang tải bản cập nhật mới...' });
                        } else if (data.type === 'not-available') {
                            // Optional: only show if manually checked, but here we just ignore or show brief info
                        } else if (data.type === 'downloaded') {
                            setUpdateDownloaded(true);
                        } else if (data.type === 'error') {
                            setFeedback({ type: 'error', message: 'Lỗi cập nhật: ' + data.message });
                        }
                    });

                } catch (e) {
                    console.error("Activation check failed", e);
                }
            } else {
                // Web mode implies no activation needed for demo
                setIsActivated(true);
            }
            setCheckingActivation(false);
        };
        check();
    }, []);

    const handleActivateApp = async (key: string): Promise<boolean> => {
        if (isDesktop && ipcRenderer) {
            const res = await ipcRenderer.invoke('activate-app', key);
            if (res.success) {
                setIsActivated(true);
                return true;
            }
            return false;
        }
        return false;
    };

    useEffect(() => {
        if (isDesktop && ipcRenderer && isActivated) {
            // Listen for file updates including discovered image paths
            ipcRenderer.on('file-content-updated', (_:any, {path, content, discoveredStatus}:any) => {
                 const wb = XLSX.read(content, {type:'buffer'});
                 const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, blankrows:false}).slice(1) as any[][];
                 let jobs: VideoJob[] = parseJobs(data);
                 
                 // Merge discovered paths/status from main process (discoveredStatus) into the jobs
                 if (discoveredStatus && Array.isArray(discoveredStatus)) {
                     const statusMap = new Map(discoveredStatus.map((j: any) => [j.id, j]));
                     jobs = jobs.map(job => {
                         const discovered = statusMap.get(job.id);
                         if (discovered && discovered.videoPath) {
                             // Update job with discovered path and mark as completed
                             return { 
                                 ...job, 
                                 videoPath: discovered.videoPath, 
                                 status: 'Completed' 
                             };
                         }
                         return job;
                     });
                 }

                 setTrackedFiles(prev => prev.map(f => {
                     if (f.path === path) {
                         // Preserve timestamps for existing jobs if status matches
                         const oldJobsMap = new Map<string, VideoJob>(f.jobs.map(j => [j.id, j]));
                         const mergedJobs = jobs.map(newJob => {
                             const oldJob = oldJobsMap.get(newJob.id);
                             if (oldJob && oldJob.status === newJob.status) {
                                 return { ...newJob, lastUpdated: oldJob.lastUpdated };
                             }
                             // Status changed, reset timestamp
                             return { ...newJob, lastUpdated: Date.now() };
                         });
                         return { ...f, jobs: mergedJobs };
                     }
                     return f;
                 }));
            });
            ipcRenderer.invoke('check-ffmpeg').then((res:any) => setFfmpegFound(res.found));
        }
    }, [isActivated]); 

    // Auto-Reset Stuck Jobs Watchdog (Every minute)
    useEffect(() => {
        if (!isDesktop || !ipcRenderer || !isActivated) return;
        const interval = setInterval(() => {
            const now = Date.now();
            const stuckThreshold = 5 * 60 * 1000; // 5 minutes

            trackedFilesRef.current.forEach(file => {
                const stuckJobs = file.jobs.filter(job => 
                    (job.status === 'Processing' || job.status === 'Generating') &&
                    job.lastUpdated && 
                    (now - job.lastUpdated > stuckThreshold)
                );

                if (stuckJobs.length > 0) {
                    const updates = stuckJobs.map(j => ({ id: j.id, status: '' })); // Reset to empty
                    ipcRenderer.invoke('update-jobs', { filePath: file.path, updates })
                        .then(() => {
                            setFeedback({ type: 'info', message: `Tự động đặt lại ${stuckJobs.length} job bị treo trong ${file.name}` });
                        });
                }
            });
        }, 60000);
        return () => clearInterval(interval);
    }, [isActivated]);

    const parseJobs = (data: any[][]): VideoJob[] => {
         return data.map((r,i) => ({
             id: r[0]||`job_${i}`, prompt: r[1]||'', 
             imagePath: r[2]||'', imagePath2: r[3]||'', imagePath3: r[4]||'',
             imagePath4: r[5]||'', imagePath5: r[6]||'', imagePath6: r[7]||'',
             imagePath7: r[8]||'', imagePath8: r[9]||'', imagePath9: r[10]||'', imagePath10: r[11]||'',
             status: r[12] as any || '', // Default to empty
             videoName: r[13]||'', typeVideo: r[14]||'IMG', videoPath: r[15]||undefined,
             lastUpdated: Date.now()
         }));
    };

    const handleProcessingComplete = (filePath: string, jobs: VideoJob[]) => {
        const fileName = filePath.split(/[\\/]/).pop() || 'Output.xlsx';
        const newFile = { name: fileName, path: filePath, jobs: jobs.map(j => ({...j, lastUpdated: Date.now()})) };
        setTrackedFiles(prev => [...prev, newFile]);
        setActiveTab('tracker');
        setActiveTrackerFileIndex(trackedFiles.length); 
        if(isDesktop && ipcRenderer) ipcRenderer.send('start-watching-file', filePath);
    };

    const handleWebOpenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            if(bstr) {
                 const wb = XLSX.read(bstr, {type:'buffer'});
                 const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1}).slice(1) as any[][];
                 const jobs = parseJobs(rawData);
                 setTrackedFiles(prev => [...prev, { name: file.name, path: file.name, jobs }]);
                 setActiveTab('tracker');
                 setActiveTrackerFileIndex(trackedFiles.length);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const triggerOpenFile = async () => {
        if(isDesktop && ipcRenderer) {
            const res = await ipcRenderer.invoke('open-file-dialog');
            if(res.success) {
                const newFiles = res.files.map((f:any) => {
                    // Send message to start watcher immediately (which triggers the initial scan callback)
                    ipcRenderer.send('start-watching-file', f.path);
                    
                    // Initial parse from content (paths might be missing until callback returns)
                    const wb = XLSX.read(f.content, {type:'buffer'});
                    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1}).slice(1) as any[][];
                    const jobs = parseJobs(rawData);
                    return { name: f.name, path: f.path, jobs };
                });
                setTrackedFiles(prev => [...prev, ...newFiles]);
            }
        } else {
            // Web
            if(webOpenFileRef.current) webOpenFileRef.current.click();
        }
    };

    // --- Tracker Actions ---

    const handleRetryStuck = async () => {
        if (!isDesktop || !ipcRenderer) return;
        const file = trackedFiles[activeTrackerFileIndex];
        if (!file || !file.path) return;

        // Reset all that are NOT Completed to ""
        const jobsToReset = file.jobs.filter(j => j.status !== 'Completed');
        if (jobsToReset.length === 0) {
            setFeedback({ type: 'info', message: 'Không có job nào cần đặt lại.' });
            return;
        }

        if (confirm(`Đặt lại trạng thái cho ${jobsToReset.length} job chưa hoàn thành?`)) {
            const updates = jobsToReset.map(j => ({ id: j.id, status: '' }));
            const res = await ipcRenderer.invoke('update-jobs', { filePath: file.path, updates });
            if (res.success) setFeedback({ type: 'success', message: `Đã đặt lại ${res.count} job.` });
            else setFeedback({ type: 'error', message: res.error });
        }
    };

    const handleRetryJob = async (id: string, fileIdx: number) => {
        if (!isDesktop || !ipcRenderer) return;
        const file = trackedFiles[fileIdx];
        if (!file || !file.path) return;
        
        const updates = [{ id, status: '' }];
        await ipcRenderer.invoke('update-jobs', { filePath: file.path, updates });
        setFeedback({ type: 'success', message: 'Đã đặt lại trạng thái Job.' });
    };

    const handleDeleteVideo = async (id: string, path: string, fileIdx: number) => {
        if (!isDesktop || !ipcRenderer) return;
        const file = trackedFiles[fileIdx];
        
        // 1. Delete File
        const delRes = await ipcRenderer.invoke('delete-file', path);
        if (!delRes.success) {
            setFeedback({ type: 'error', message: 'Không thể xóa file.' });
            return;
        }

        // 2. Reset Status
        if (file && file.path) {
            const updates = [{ id, status: '' }];
            await ipcRenderer.invoke('update-jobs', { filePath: file.path, updates });
            setFeedback({ type: 'success', message: 'Đã xóa file và đặt lại Job.' });
        }
    };

    // --- RENDER ---

    if (checkingActivation) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-white">
                <LoaderIcon />
            </div>
        );
    }

    if (!isActivated) {
        return <Activation machineId={machineId} onActivate={handleActivateApp} />;
    }

    return (
        <div className="h-screen overflow-hidden flex flex-col font-sans text-manga-black bg-white">
            <input 
                type="file" 
                ref={webOpenFileRef} 
                style={{display:'none'}} 
                accept=".xlsx" 
                onChange={handleWebOpenFileChange}
            />

            {/* Manga Style Header */}
            <header className="px-6 py-4 border-b-4 border-black flex justify-between items-center z-50 bg-white relative">
                <div className="absolute bottom-[-4px] left-0 w-full h-[4px] bg-black"></div>
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('generator')}>
                    <div className="bg-black text-white p-2 border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.2)] transform -rotate-3">
                        <span className="text-3xl font-comic">V</span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-comic uppercase tracking-widest leading-none">V-<span className="text-manga-accent">Manga</span></h1>
                        <span className="text-xs font-bold bg-black text-white px-2 py-0.5">AI Comic Automation</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setActiveTab('generator')} 
                        className={`px-6 py-2 font-black uppercase border-2 border-black transition-all shadow-comic ${activeTab === 'generator' ? 'bg-manga-accent text-white' : 'bg-white hover:bg-gray-100'}`}
                    >
                        1. Nhập Dữ Liệu
                    </button>
                    <button 
                        onClick={() => setActiveTab('tracker')} 
                        className={`px-6 py-2 font-black uppercase border-2 border-black transition-all shadow-comic ${activeTab === 'tracker' ? 'bg-manga-accent text-white' : 'bg-white hover:bg-gray-100'}`}
                    >
                        2. Theo Dõi ({trackedFiles.length})
                    </button>
                </div>
            </header>

            <div className="flex-1 p-6 overflow-hidden bg-white relative">
                {/* Fix: Use CSS gradient instead of external URL to prevent 404 error */}
                <div className="absolute top-0 left-0 w-full h-full opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:4px_4px] pointer-events-none"></div>
                
                <div className="max-w-[1600px] mx-auto h-full overflow-y-auto custom-scrollbar relative z-10">
                    {activeTab === 'generator' ? (
                        <MangaProcessor 
                            onProcessingComplete={handleProcessingComplete}
                            onFeedback={setFeedback}
                        />
                    ) : (
                        <Tracker 
                            trackedFiles={trackedFiles} 
                            activeFileIndex={activeTrackerFileIndex} 
                            setActiveFileIndex={setActiveTrackerFileIndex} 
                            onOpenFile={triggerOpenFile} 
                            onCloseFile={(idx) => {
                                setTrackedFiles(p => p.filter((_,i) => i !== idx));
                                if(activeTrackerFileIndex >= idx) setActiveTrackerFileIndex(Math.max(0, activeTrackerFileIndex - 1));
                            }} 
                            stats={{}} 
                            ffmpegFound={ffmpegFound} 
                            isCombining={false}
                            onPlayVideo={(path) => isDesktop && ipcRenderer && ipcRenderer.send('open-video-path', path)} 
                            onShowFolder={(path) => isDesktop && ipcRenderer && ipcRenderer.send('open-folder', path.substring(0, path.lastIndexOf(navigator.userAgent.includes("Windows")?'\\':'/')))} 
                            onOpenToolFlows={() => {
                                if(isDesktop && ipcRenderer) {
                                    ipcRenderer.invoke('open-tool-flow').then((res:any) => {
                                        if(!res.success) setFeedback({type:'error', message: 'Chưa cấu hình đường dẫn Tool hoặc không tìm thấy file.'});
                                        else setFeedback({type:'success', message: 'Đang mở ToolFlow...'});
                                    });
                                }
                            }} 
                            onSetToolFlowPath={() => isDesktop && ipcRenderer && ipcRenderer.invoke('set-tool-flow-path')}
                            onReloadVideos={() => {}} 
                            onRetryStuck={handleRetryStuck} 
                            onRetryJob={handleRetryJob} 
                            onDeleteVideo={handleDeleteVideo}
                            onCombine={() => {}} 
                            onCombineAll={() => {}} 
                            onLinkVideo={() => {}}
                        />
                    )}
                </div>
            </div>

            {feedback && (
                <div className={`fixed bottom-10 right-10 px-8 py-4 bg-white border-4 border-black shadow-[8px_8px_0px_#000] z-[300] font-comic uppercase tracking-wider flex items-center gap-4 animate-fade-in ${feedback.type === 'error' ? 'text-red-600' : 'text-black'}`}>
                    <span className="text-2xl">{feedback.type === 'error' ? '💢' : '💬'}</span>
                    <span>{feedback.message}</span>
                </div>
            )}
            
            {/* Update Modal */}
            {updateDownloaded && (
                <AlertModal 
                    title="CẬP NHẬT MỚI" 
                    message="Phiên bản mới đã được tải xuống. Khởi động lại ứng dụng để áp dụng thay đổi?" 
                    type="update"
                    onClose={() => setUpdateDownloaded(false)} // Cho phép đóng nếu chưa muốn update ngay
                    onConfirm={() => {
                        if(isDesktop && ipcRenderer) ipcRenderer.invoke('restart-app-update');
                    }}
                />
            )}
        </div>
    );
};

export default App;