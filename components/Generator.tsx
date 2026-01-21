
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadIcon, FolderIcon, LoaderIcon, VideoIcon } from './Icons';
import { isElectron, getIpcRenderer } from '../utils/platform';

interface MangaProcessorProps {
    onProcessingComplete: (outputFilePath: string, jobs: any[]) => void;
    onFeedback: (feedback: { type: 'error' | 'success' | 'info', message: string } | null) => void;
}

export const MangaProcessor: React.FC<MangaProcessorProps> = ({ onProcessingComplete, onFeedback }) => {
    const [charFolderPath, setCharFolderPath] = useState('');
    const [inputExcelPath, setInputExcelPath] = useState('');
    const [outputFileName, setOutputFileName] = useState('Manga_Output');
    const [outputFolderPath, setOutputFolderPath] = useState('');
    const [charFiles, setCharFiles] = useState<{name: string, fullPath: string}[]>([]); 
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    
    const folderInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isDesktop = isElectron();
    const ipcRenderer = getIpcRenderer();

    const handleSelectFolder = async () => {
        if (isDesktop && ipcRenderer) {
            const res = await ipcRenderer.invoke('open-folder-dialog');
            if (res.success) {
                setCharFolderPath(res.path);
                const filesRes = await ipcRenderer.invoke('read-dir', res.path);
                if (filesRes.success) {
                    setCharFiles(filesRes.files);
                    onFeedback({ type: 'success', message: `Đã tải ${filesRes.files.length} ảnh nhân vật.` });
                }
            }
        } else {
            if (folderInputRef.current) folderInputRef.current.click();
        }
    };

    const handleSelectExcel = async () => {
        if (isDesktop && ipcRenderer) {
            const res = await ipcRenderer.invoke('open-file-dialog');
            if (res.success && res.files.length > 0) {
                const file = res.files[0];
                setInputExcelPath(file.path);
                readExcelBuffer(file.content);
            }
        } else {
            if (fileInputRef.current) fileInputRef.current.click();
        }
    };

    const readExcelBuffer = (buffer: any) => {
        try {
            const wb = XLSX.read(buffer, {type: 'buffer' as any}); 
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);
            setPreviewData(data);
            onFeedback({ type: 'info', message: `Đã đọc ${data.length} dòng dữ liệu.` });
        } catch (err) {
            onFeedback({ type: 'error', message: 'Lỗi đọc file Excel.' });
        }
    };

    const processFile = async (mode: 'image' | 'video') => {
        if (!charFiles.length || !previewData.length) {
            onFeedback({ type: 'error', message: 'Vui lòng chọn đủ thư mục ảnh và file Excel.' });
            return;
        }

        setIsProcessing(true);
        try {
            const baseOutputName = outputFileName.replace(/\.xlsx$/i, '');
            const excelHeader = [
                "JOB_ID", "PROMPT", 
                "IMAGE_PATH", "IMAGE_PATH_2", "IMAGE_PATH_3", "IMAGE_PATH_4", "IMAGE_PATH_5",
                "IMAGE_PATH_6", "IMAGE_PATH_7", "IMAGE_PATH_8", "IMAGE_PATH_9", "IMAGE_PATH_10",
                "STATUS", "VIDEO_NAME", "TYPE_VIDEO"
            ];

            const excelRows: any[][] = [excelHeader];
            const internalJobs: any[] = [];

            previewData.forEach((row: any, index: number) => {
                const charsStr = row['Characters'] || '';
                const description = row['Description'] || '';
                const stt = row['stt'] || (index + 1);
                
                let foundImagesCount = 0;
                const foundPaths: string[] = Array(10).fill('');

                if (charsStr && typeof charsStr === 'string') {
                    const charNames = charsStr.split(/[,;]/).map(c => c.trim()).filter(c => c);
                    for (const charName of charNames) {
                        if (foundImagesCount >= 10) break;
                        const found = charFiles.find(f => f.name.toLowerCase().includes(charName.toLowerCase()));
                        if (found) {
                            foundPaths[foundImagesCount] = found.fullPath;
                            foundImagesCount++;
                        }
                    }
                }

                let typeVideo = mode === 'image' ? 'IMG' : (foundPaths[0] ? 'IN2V' : 'STORY');
                const jobId = `Job_${stt}`;
                const videoName = `${baseOutputName}_${stt}`;

                excelRows.push([jobId, description, ...foundPaths, '', videoName, typeVideo]);
                internalJobs.push({
                    id: jobId, prompt: description, status: '', videoName, typeVideo,
                    imagePath: foundPaths[0], imagePath2: foundPaths[1], imagePath3: foundPaths[2]
                });
            });

            const ws = XLSX.utils.aoa_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "MangaJobs");
            
            if (isDesktop && ipcRenderer) {
                const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const res = await ipcRenderer.invoke('save-file-dialog', { defaultPath: `${baseOutputName}.xlsx`, fileContent: outBuffer });
                if (res.success) {
                    onFeedback({ type: 'success', message: 'Đã xuất file Job thành công!' });
                    onProcessingComplete(res.filePath, internalJobs);
                }
            } else {
                XLSX.writeFile(wb, `${outputFileName}.xlsx`);
                onProcessingComplete(`${outputFileName}.xlsx`, internalJobs);
            }
        } catch (e: any) {
            onFeedback({ type: 'error', message: `Lỗi: ${e.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="manga-panel p-8 bg-white relative">
                 <div className="absolute -top-4 -left-4 bg-manga-accent text-white px-4 py-1 font-comic border-2 border-black shadow-comic text-xl transform -rotate-2 z-20">
                    Cấu Hình Nhập Liệu
                 </div>
                 
                 <div className="space-y-6 mt-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-bold uppercase text-xs text-gray-400 tracking-widest">Thư mục ảnh nhân vật</label>
                        <div className="flex gap-4">
                            <div className="flex-1 border-2 border-black p-3 bg-manga-gray font-mono text-sm truncate">
                                {charFolderPath || 'Chưa chọn thư mục...'}
                            </div>
                            <button onClick={handleSelectFolder} className="bg-white border-2 border-black px-6 py-2 hover:bg-black hover:text-white transition shadow-comic font-bold uppercase flex items-center gap-2 whitespace-nowrap">
                                <FolderIcon className="w-5 h-5"/> Chọn Folder
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="font-bold uppercase text-xs text-gray-400 tracking-widest">File Excel Kịch bản</label>
                        <div className="flex gap-4">
                            <div className="flex-1 border-2 border-black p-3 bg-manga-gray font-mono text-sm truncate">
                                {inputExcelPath || 'Chưa chọn file...'}
                            </div>
                            <button onClick={handleSelectExcel} className="bg-white border-2 border-black px-6 py-2 hover:bg-black hover:text-white transition shadow-comic font-bold uppercase flex items-center gap-2 whitespace-nowrap">
                                <UploadIcon className="w-5 h-5"/> Chọn Excel
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 border-t-2 border-dashed border-gray-200">
                         <div className="flex flex-col gap-2">
                            <label className="font-bold uppercase text-xs text-gray-400 tracking-widest">Tên file kết quả</label>
                            <input 
                                type="text" 
                                value={outputFileName} 
                                onChange={(e) => setOutputFileName(e.target.value)}
                                className="w-full border-2 border-black p-3 font-bold"
                            />
                        </div>
                    </div>
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <button onClick={() => processFile('image')} disabled={isProcessing} className="bg-white text-black font-comic text-xl px-8 py-4 border-4 border-black shadow-comic hover:bg-manga-gray transition-all flex items-center justify-center gap-3">
                    {isProcessing ? <LoaderIcon /> : <><UploadIcon className="w-6 h-6"/><span>XUẤT JOB ẢNH</span></>}
                 </button>

                 <button onClick={() => processFile('video')} disabled={isProcessing} className="bg-manga-accent text-white font-comic text-xl px-8 py-4 border-4 border-black shadow-comic transition-all flex items-center justify-center gap-3">
                    {isProcessing ? <LoaderIcon /> : <><VideoIcon className="w-6 h-6"/><span>XUẤT JOB VIDEO</span></>}
                 </button>
            </div>
            
            <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                * Đảm bảo tên nhân vật trong Excel khớp với tên file ảnh trong thư mục.
            </p>
        </div>
    );
};
