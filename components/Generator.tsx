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

    const handleSelectOutputFolder = async () => {
        if (isDesktop && ipcRenderer) {
            const res = await ipcRenderer.invoke('open-folder-dialog');
            if (res.success) setOutputFolderPath(res.path);
        }
    };

    const handleWebFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const fileList = Array.from(files).map((f: File) => ({ name: f.name, fullPath: f.name }));
            setCharFiles(fileList);
            setCharFolderPath(`Upload: ${files.length} files`);
            onFeedback({ type: 'success', message: `Đã tải ${files.length} ảnh từ trình duyệt.` });
        }
    };

    const handleSelectExcel = async () => {
        if (isDesktop && ipcRenderer) {
            const res = await ipcRenderer.invoke('open-file-dialog');
            if (res.success && res.files.length > 0) {
                const file = res.files[0];
                setInputExcelPath(file.path);
                if (!outputFolderPath) {
                    const sep = navigator.userAgent.includes("Windows") ? '\\' : '/';
                    const pathParts = file.path.split(sep);
                    pathParts.pop();
                    setOutputFolderPath(pathParts.join(sep));
                }
                readExcelBuffer(file.content);
            }
        } else {
            if (fileInputRef.current) fileInputRef.current.click();
        }
    };

    const handleWebExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setInputExcelPath(file.name);
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                if (bstr) readExcelBuffer(bstr);
            };
            reader.readAsArrayBuffer(file);
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
            onFeedback({ type: 'error', message: 'Vui lòng chọn đủ thư mục ảnh và file Excel đầu vào.' });
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
                
                let hasRefImages = false;
                let foundImagesCount = 0;
                const foundPaths: string[] = Array(10).fill('');

                if (charsStr && typeof charsStr === 'string' && charsStr.trim() !== '') {
                    const charNames = Array.from(new Set(charsStr.split(/[,;]/).map(c => c.trim()).filter(c => c)));
                    
                    for (const charName of charNames) {
                        if (foundImagesCount >= 10) break;

                        const found = charFiles.find(f => {
                            const fname = f.name.toLowerCase();
                            const cname = charName.toLowerCase();
                            return fname.startsWith(cname + '.') || fname === cname;
                        });

                        if (found) {
                            foundPaths[foundImagesCount] = found.fullPath;
                            foundImagesCount++;
                            hasRefImages = true;
                        }
                    }
                }

                let typeVideo = 'IMG';
                if (mode === 'image') {
                    typeVideo = 'IMG';
                } else {
                    typeVideo = hasRefImages ? 'IN2V' : '';
                }

                const jobId = `Job_${stt}`;
                const videoName = `${baseOutputName}_${stt}`;

                const excelRow = [
                    jobId,
                    description,
                    ...foundPaths,
                    '', 
                    videoName,
                    typeVideo
                ];
                excelRows.push(excelRow);

                internalJobs.push({
                    id: jobId,
                    prompt: description,
                    status: '',
                    videoName: videoName,
                    typeVideo: typeVideo,
                    imagePath: foundPaths[0],
                    imagePath2: foundPaths[1],
                    imagePath3: foundPaths[2],
                    imagePath4: foundPaths[3],
                    imagePath5: foundPaths[4],
                    imagePath6: foundPaths[5],
                    imagePath7: foundPaths[6],
                    imagePath8: foundPaths[7],
                    imagePath9: foundPaths[8],
                    imagePath10: foundPaths[9],
                });
            });

            const ws = XLSX.utils.aoa_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "MangaJobs");
            
            if (isDesktop && ipcRenderer) {
                const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const fileName = outputFileName.endsWith('.xlsx') ? outputFileName : `${outputFileName}.xlsx`;
                
                let fullPath = '';
                if (outputFolderPath) {
                    const sep = navigator.userAgent.includes("Windows") ? '\\' : '/';
                    fullPath = `${outputFolderPath}${sep}${fileName}`;
                } else {
                    fullPath = fileName; 
                }

                if (outputFolderPath) {
                     const saveRes = await ipcRenderer.invoke('save-file-custom', { path: fullPath, content: outBuffer });
                     if (saveRes.success) {
                        onFeedback({ type: 'success', message: 'Đã lưu file thành công!' });
                        onProcessingComplete(fullPath, internalJobs);
                     } else {
                        onFeedback({ type: 'error', message: 'Lỗi khi lưu file: ' + saveRes.error });
                     }
                } else {
                    const saveRes = await ipcRenderer.invoke('save-file-dialog', { defaultPath: fileName, fileContent: outBuffer });
                    if (saveRes.success) {
                        onFeedback({ type: 'success', message: 'Đã lưu file thành công!' });
                        onProcessingComplete(saveRes.filePath, internalJobs);
                    }
                }
            } else {
                XLSX.writeFile(wb, `${outputFileName}.xlsx`);
                onFeedback({ type: 'success', message: 'Đã tải xuống file Excel!' });
                onProcessingComplete(`${outputFileName}.xlsx`, internalJobs);
            }
        } catch (e: any) {
            onFeedback({ type: 'error', message: `Lỗi xử lý: ${e.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4">
            <input type="file" ref={folderInputRef} style={{display: 'none'}} {...({ webkitdirectory: '', directory: '' } as any)} multiple onChange={handleWebFolderChange} />
            <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".xlsx, .xls" onChange={handleWebExcelChange} />

            <div className="manga-panel p-8 bg-white relative">
                 <div className="absolute -top-4 -left-4 bg-manga-accent text-white px-4 py-1 font-comic border-2 border-black shadow-comic text-xl transform -rotate-2">
                    BƯỚC 1: NHẬP DỮ LIỆU ĐẦU VÀO
                 </div>
                 
                 <div className="space-y-6 mt-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-bold uppercase tracking-wider text-sm">1. Thư mục ảnh nhân vật</label>
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
                        <label className="font-bold uppercase tracking-wider text-sm">2. File Excel Kịch bản</label>
                        <div className="flex gap-4">
                            <div className="flex-1 border-2 border-black p-3 bg-manga-gray font-mono text-sm truncate">
                                {inputExcelPath || 'Chưa chọn file...'}
                            </div>
                            <button onClick={handleSelectExcel} className="bg-white border-2 border-black px-6 py-2 hover:bg-black hover:text-white transition shadow-comic font-bold uppercase flex items-center gap-2 whitespace-nowrap">
                                <UploadIcon className="w-5 h-5"/> Chọn Excel
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-dashed border-gray-300">
                        <div className="flex flex-col gap-2">
                            <label className="font-bold uppercase tracking-wider text-sm">3. Tên File Kết Quả</label>
                            <input type="text" value={outputFileName} onChange={(e) => setOutputFileName(e.target.value)} className="border-2 border-black p-3 font-bold" />
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <label className="font-bold uppercase tracking-wider text-sm">4. Thư mục lưu kết quả</label>
                            <div className="flex gap-2">
                                <div className="flex-1 border-2 border-black p-3 bg-gray-50 font-mono text-xs truncate">{outputFolderPath || 'Mặc định'}</div>
                                <button onClick={handleSelectOutputFolder} className="bg-white border-2 border-black px-3 hover:bg-black hover:text-white transition"><FolderIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    </div>
                 </div>
            </div>

            <div className="flex flex-col md:flex-row justify-center gap-6">
                 <button onClick={() => processFile('image')} disabled={isProcessing} className="flex-1 bg-white text-black font-comic text-xl px-8 py-4 border-4 border-black shadow-comic hover:bg-manga-gray transition-all flex items-center justify-center gap-3">
                    {isProcessing ? <LoaderIcon /> : <><UploadIcon className="w-6 h-6"/><span>TẠO ẢNH (IMG)</span></>}
                 </button>

                 <button onClick={() => processFile('video')} disabled={isProcessing} className="flex-1 bg-manga-accent text-white font-comic text-xl px-8 py-4 border-4 border-black shadow-comic transition-all flex items-center justify-center gap-3">
                    {isProcessing ? <LoaderIcon /> : <><VideoIcon className="w-6 h-6"/><span>TẠO VIDEO</span></>}
                 </button>
            </div>
        </div>
    );
};
