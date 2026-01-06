
import React, { useState } from 'react';
import { TrackedFile, VideoJob, JobStatus } from '../types';
import { PlayIcon, FolderIcon, TrashIcon, RetryIcon, UploadIcon, CogIcon, ExternalLinkIcon, CheckIcon, CopyIcon } from './Icons';
import { isElectron } from '../utils/platform';

interface TrackerProps {
    trackedFiles: TrackedFile[];
    activeFileIndex: number;
    setActiveFileIndex: (index: number) => void;
    onOpenFile: () => void;
    onCloseFile: (index: number) => void;
    stats: any; 
    ffmpegFound: boolean | null;
    isCombining: boolean;
    onPlayVideo: (path: string) => void;
    onShowFolder: (path: string) => void;
    onOpenToolFlows: () => void;
    onSetToolFlowPath: () => void;
    onReloadVideos: () => void;
    onRetryStuck: () => void; // Used for "Reset All Incomplete"
    onRetryJob: (id: string, fileIdx: number) => void; // Regenerate single
    onDeleteVideo: (id: string, path: string, fileIdx: number) => void; // Delete single
    onCombine: (mode: 'normal' | 'timed') => void;
    onCombineAll: () => void;
    onLinkVideo: (id: string, fileIdx: number) => void;
}

export const Tracker: React.FC<TrackerProps> = (props) => {
    const { trackedFiles, activeFileIndex, setActiveFileIndex } = props;
    const currentFile = trackedFiles[activeFileIndex];
    const isDesktop = isElectron();
    const [pathCopied, setPathCopied] = useState(false);

    const getStatusStyle = (status: JobStatus) => {
        if (!status) return "bg-gray-100 text-gray-400 border-gray-200"; // Empty status
        switch (status) {
            case 'Completed': return "bg-black text-white border-black";
            case 'Processing': return "bg-yellow-100 text-yellow-800 border-yellow-300 animate-pulse";
            case 'Generating': return "bg-blue-100 text-blue-800 border-blue-300 animate-pulse";
            case 'Failed': return "bg-red-50 text-red-600 border border-red-200";
            default: return "bg-white text-gray-500 border border-gray-300";
        }
    };

    const resolveImagePath = (imgName: string) => {
        if (!imgName) return null;
        if (!isDesktop) return null; 
        return imgName.startsWith('file://') ? imgName : `file://${imgName}`;
    };

    const renderRefImages = (job: VideoJob) => {
        const images: string[] = [
            job.imagePath, job.imagePath2, job.imagePath3, job.imagePath4, job.imagePath5,
            job.imagePath6, job.imagePath7, job.imagePath8, job.imagePath9, job.imagePath10
        ].filter((img): img is string => !!img);

        if (images.length === 0) return <span className="text-xs text-gray-400 font-mono">NO REF</span>;

        return (
            <div className="flex flex-wrap gap-1 w-40">
                {images.map((img, i) => (
                    <div key={i} className="w-8 h-8 border border-black overflow-hidden bg-gray-200" title={`Ref ${i+1}`}>
                        {isDesktop ? (
                            <img 
                                src={resolveImagePath(img) || ''} 
                                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all"
                                alt="ref"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] bg-gray-300 text-black font-bold cursor-help" title={img}>IMG</div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const handleToolFlowClick = () => {
        if (!isDesktop) {
            alert("Chức năng chạy ToolFlow chỉ khả dụng trên phiên bản Desktop (Windows/Mac).");
            return;
        }
        props.onOpenToolFlows();
    };

    const handleToolFlowConfigClick = () => {
        if (!isDesktop) {
            alert("Cấu hình ToolFlow chỉ khả dụng trên phiên bản Desktop.");
            return;
        }
        props.onSetToolFlowPath();
    };

    const handleCopyFolderPath = () => {
        if (currentFile && currentFile.path) {
            const sep = navigator.userAgent.includes("Windows") ? '\\' : '/';
            const folderPath = currentFile.path.substring(0, currentFile.path.lastIndexOf(sep));
            navigator.clipboard.writeText(folderPath);
            setPathCopied(true);
            setTimeout(() => setPathCopied(false), 2000);
        }
    };

    if (trackedFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-10 border-4 border-dashed border-black bg-white m-4">
                 <h2 className="text-4xl font-comic mb-4 uppercase">CHƯA CÓ DỰ ÁN</h2>
                 <p className="font-mono text-sm mb-8">Vui lòng tạo job ở tab Nhập Dữ Liệu hoặc mở file Excel có sẵn.</p>
                 <button onClick={props.onOpenFile} className="bg-black text-white px-8 py-3 font-bold uppercase shadow-comic hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all border-2 border-black">
                    Mở Dự Án Cũ
                 </button>
            </div>
        );
    }

    return (
        <div className="flex h-[80vh] border-4 border-black bg-white shadow-[10px_10px_0px_rgba(0,0,0,0.2)]">
            {/* Sidebar */}
            <div className="w-64 border-r-4 border-black bg-manga-gray flex flex-col">
                <div className="p-4 border-b-4 border-black bg-white">
                    <button onClick={props.onOpenFile} className="w-full border-2 border-black py-2 font-bold uppercase hover:bg-black hover:text-white transition flex items-center justify-center gap-2 text-xs">
                        <UploadIcon className="w-4 h-4" /> Mở Dự Án
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {trackedFiles.map((file, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => setActiveFileIndex(idx)} 
                            className={`p-3 border-2 cursor-pointer transition-all relative ${idx === activeFileIndex ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:bg-gray-200'}`}
                        >
                            <div className="font-bold text-xs truncate uppercase pr-6">{file.name}</div>
                            <div className="text-[10px] mt-1 font-mono opacity-70">
                                {file.jobs.filter(j => j.status === 'Completed').length} / {file.jobs.length} XONG
                            </div>
                            <button 
                                onClick={(e) => {e.stopPropagation(); props.onCloseFile(idx);}} 
                                className="absolute top-1 right-1 hover:text-red-500 font-bold px-2"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white">
                {/* Toolbar */}
                <div className="p-4 border-b-4 border-black flex justify-between items-center bg-white gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                         {/* Stats Pill */}
                        <div className="border-2 border-black px-4 py-2 bg-manga-gray flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-gray-500">Tiến độ</span>
                            <span className="text-xl font-comic leading-none">
                                {currentFile.jobs.filter(j => j.status === 'Completed').length} / {currentFile.jobs.length}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tool Flow Buttons - Always Visible */}
                        <div className="flex items-center border-2 border-black p-1 gap-1 bg-gray-50">
                            <button onClick={handleToolFlowClick} className="px-3 py-1 bg-manga-accent text-white hover:bg-red-600 transition font-bold uppercase text-xs flex items-center gap-2">
                                <PlayIcon className="w-4 h-4"/> Chạy Tool
                            </button>
                            <button onClick={handleToolFlowConfigClick} className="px-2 py-1 hover:bg-gray-200 text-black border-l border-gray-300" title="Cấu hình đường dẫn Tool">
                                <CogIcon className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* Desktop Actions */}
                        {isDesktop && (
                            <button onClick={props.onRetryStuck} className="border-2 border-black px-4 py-2 hover:bg-yellow-400 hover:text-black transition font-bold uppercase text-xs flex items-center gap-2" title="Đặt lại trạng thái các job chưa hoàn thành">
                                <RetryIcon className="w-4 h-4"/> Đặt lại tất cả
                            </button>
                        )}
                        
                        {isDesktop && (
                            <div className="flex border-2 border-black p-0 bg-white">
                                 <button onClick={() => props.onShowFolder(currentFile.path!)} className="px-4 py-2 hover:bg-black hover:text-white font-bold uppercase text-xs flex items-center gap-2 border-r border-black">
                                    <FolderIcon className="w-4 h-4"/> Thư mục
                                </button>
                                <button onClick={handleCopyFolderPath} className="px-3 py-2 hover:bg-manga-accent hover:text-white transition" title="Sao chép đường dẫn thư mục">
                                    {pathCopied ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                    <table className="w-full border-collapse border-2 border-black bg-white text-sm">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-3 border border-gray-600 text-left w-16">ID</th>
                                <th className="p-3 border border-gray-600 text-left w-24">TRẠNG THÁI</th>
                                <th className="p-3 border border-gray-600 text-left">NỘI DUNG / MÔ TẢ</th>
                                <th className="p-3 border border-gray-600 text-left w-40">NHÂN VẬT (REF)</th>
                                <th className="p-3 border border-gray-600 text-center w-32">KẾT QUẢ</th>
                                <th className="p-3 border border-gray-600 text-center w-32">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentFile.jobs.map((job) => (
                                <tr key={job.id} className="hover:bg-gray-100 font-mono">
                                    <td className="p-3 border border-black font-bold">{job.id.replace('Job_', '#')}</td>
                                    <td className="p-3 border border-black">
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase border rounded-sm ${getStatusStyle(job.status)} block text-center`}>
                                            {job.status || 'CHỜ'}
                                        </span>
                                    </td>
                                    <td className="p-3 border border-black text-xs">
                                        <div className="line-clamp-3" title={job.prompt}>{job.prompt}</div>
                                    </td>
                                    <td className="p-3 border border-black">
                                        {renderRefImages(job)}
                                    </td>
                                    <td className="p-3 border border-black text-center">
                                        {job.status === 'Completed' && job.videoPath ? (
                                            <div className="flex flex-col items-center gap-1 group">
                                                <div className="w-24 h-24 border-2 border-black p-1 bg-white cursor-pointer relative" onClick={() => props.onPlayVideo(job.videoPath!)}>
                                                    {isDesktop ? (
                                                        <img 
                                                            src={`file://${job.videoPath.replace(/\\/g, '/')}`} 
                                                            className="w-full h-full object-contain" 
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 font-bold p-1 break-all text-center">FILE OK</div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] font-mono max-w-[100px] truncate" title={job.videoName}>
                                                    {job.videoName}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="p-3 border border-black text-center">
                                        <div className="flex gap-1 justify-center">
                                            {job.status === 'Completed' && job.videoPath ? (
                                                <>
                                                     <button 
                                                        onClick={() => props.onPlayVideo(job.videoPath!)} 
                                                        className="p-2 border border-black bg-white hover:bg-black hover:text-white transition"
                                                        title="Mở Ảnh"
                                                    >
                                                        <ExternalLinkIcon className="w-4 h-4"/>
                                                    </button>
                                                    <button 
                                                        onClick={() => { if(confirm('Xóa ảnh kết quả và đặt lại trạng thái?')) props.onDeleteVideo(job.id, job.videoPath!, activeFileIndex); }} 
                                                        className="p-2 border border-black bg-white hover:bg-red-600 hover:text-white transition"
                                                        title="Xóa & Làm lại"
                                                    >
                                                        <TrashIcon className="w-4 h-4"/>
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => props.onRetryJob(job.id, activeFileIndex)}
                                                    className="p-2 border border-black bg-white hover:bg-manga-accent hover:text-white transition"
                                                    title="Tạo lại / Đặt lại trạng thái"
                                                >
                                                    <RetryIcon className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
