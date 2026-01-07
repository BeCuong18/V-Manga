import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadIcon, FolderIcon, CheckIcon, LoaderIcon, CopyIcon } from './Icons';
import { isElectron, getIpcRenderer } from '../utils/platform';

interface MangaProcessorProps {
    onProcessingComplete: (outputFilePath: string, jobs: any[]) => void;
    onFeedback: (feedback: { type: 'error' | 'success' | 'info', message: string } | null) => void;
}

export const MangaProcessor: React.FC<MangaProcessorProps> = ({ onProcessingComplete, onFeedback }) => {
    const [charFolderPath, setCharFolderPath] = useState('');
    const [inputExcelPath, setInputExcelPath] = useState('');
    
    // New states for Output configuration
    const [outputFileName, setOutputFileName] = useState('Manga_Output');
    const [outputFolderPath, setOutputFolderPath] = useState('');

    // Desktop: Stores full paths. Web: Stores File objects for preview/processing if needed.
    const [charFiles, setCharFiles] = useState<{name: string, fullPath: string}[]>([]); 
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    
    // Refs for Web inputs
    const folderInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isDesktop = isElectron();
    const ipcRenderer = getIpcRenderer();

    // --- HANDLERS ---

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
            // Web Mode
            if (folderInputRef.current) {
                folderInputRef.current.click();
            }
        }
    };

    const handleSelectOutputFolder = async () => {
        if (isDesktop && ipcRenderer) {
            const res = await ipcRenderer.invoke('open-folder-dialog');
            if (res.success) {
                setOutputFolderPath(res.path);
            }
        }
    };

    const handleCopyOutputFolder = () => {
        if (outputFolderPath) {
            navigator.clipboard.writeText(outputFolderPath);
            onFeedback({ type: 'success', message: 'Đã sao chép đường dẫn lưu!' });
        }
    };

    const handleWebFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const fileList = Array.from(files).map((f: File) => ({
                name: f.name,
                fullPath: f.name 
            }));
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
                // Auto set default output folder to same as input if not set
                if (!outputFolderPath) {
                    const sep = navigator.userAgent.includes("Windows") ? '\\' : '/';
                    const pathParts = file.path.split(sep);
                    pathParts.pop(); // remove filename
                    setOutputFolderPath(pathParts.join(sep));
                }
                readExcelBuffer(file.content);
            }
        } else {
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
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

    const processFile = async () => {
        if (!charFiles.length || !previewData.length) {
            onFeedback({ type: 'error', message: 'Vui lòng chọn đủ thư mục ảnh và file Excel đầu vào.' });
            return;
        }

        setIsProcessing(true);
        try {
            // Lấy tên base để đặt tên file output (bỏ đuôi .xlsx nếu người dùng lỡ nhập)
            const baseOutputName = outputFileName.replace(/\.xlsx$/i, '');

            const jobs = previewData.map((row: any, index: number) => {
                const charsStr = row['Characters'] || '';
                const description = row['Description'] || '';
                const stt = row['stt'] || (index + 1);
                
                const job: any = {
                    JOB_ID: `Job_${stt}`,
                    PROMPT: description,
                    IMAGE_PATH: '',
                    IMAGE_PATH_2: '',
                    IMAGE_PATH_3: '',
                    IMAGE_PATH_4: '',
                    IMAGE_PATH_5: '',
                    IMAGE_PATH_6: '',
                    IMAGE_PATH_7: '',
                    IMAGE_PATH_8: '',
                    IMAGE_PATH_9: '',
                    IMAGE_PATH_10: '',
                    STATUS: '', // Empty status as requested
                    VIDEO_NAME: `${baseOutputName}_${stt}`, // Vẫn giữ tên cột là VIDEO_NAME cho hệ thống, nhưng giá trị là tên ảnh (VD: Manga_1)
                    TYPE_VIDEO: 'IMG'
                };

                if (charsStr && typeof charsStr === 'string' && charsStr.trim() !== '') {
                    const charNames = charsStr.split(/[,;]/).map(c => c.trim()).filter(c => c);
                    charNames.forEach((charName, i) => {
                        if (i >= 10) return; 
                        const found = charFiles.find(f => {
                             const fname = f.name.toLowerCase();
                             const cname = charName.toLowerCase();
                             return fname.startsWith(cname + '.') || fname === cname;
                        });

                        if (found) {
                            const key = i === 0 ? 'IMAGE_PATH' : `IMAGE_PATH_${i + 1}`;
                            job[key] = found.fullPath;
                        }
                    });
                }
                return job;
            });

            const headerOrder = [
                "JOB_ID", "PROMPT", 
                "IMAGE_PATH", "IMAGE_PATH_2", "IMAGE_PATH_3", "IMAGE_PATH_4", "IMAGE_PATH_5",
                "IMAGE_PATH_6", "IMAGE_PATH_7", "IMAGE_PATH_8", "IMAGE_PATH_9", "IMAGE_PATH_10",
                "STATUS", "VIDEO_NAME", "TYPE_VIDEO"
            ];

            const ws = XLSX.utils.json_to_sheet(jobs, { header: headerOrder });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "MangaJobs");
            
            // Output handling
            if (isDesktop && ipcRenderer) {
                const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const fileName = outputFileName.endsWith('.xlsx') ? outputFileName : `${outputFileName}.xlsx`;
                
                let fullPath = '';
                if (outputFolderPath) {
                    const sep = navigator.userAgent.includes("Windows") ? '\\' : '/';
                    fullPath = `${outputFolderPath}${sep}${fileName}`;
                } else {
                    fullPath = fileName; // Fallback, though user should select folder
                }

                // If folder is selected, save directly. If not, ask dialog.
                if (outputFolderPath) {
                     const saveRes = await ipcRenderer.invoke('save-file-custom', { path: fullPath, content: outBuffer });
                     if (saveRes.success) {
                        onFeedback({ type: 'success', message: 'Đã lưu file thành công!' });
                        completeProcess(fullPath, jobs);
                     } else {
                        onFeedback({ type: 'error', message: 'Lỗi khi lưu file: ' + saveRes.error });
                     }
                } else {
                    const saveRes = await ipcRenderer.invoke('save-file-dialog', { 
                        defaultPath: fileName, 
                        fileContent: outBuffer 
                    });
                    if (saveRes.success) {
                        onFeedback({ type: 'success', message: 'Đã lưu file thành công!' });
                        completeProcess(saveRes.filePath, jobs);
                    }
                }
            } else {
                XLSX.writeFile(wb, `${outputFileName}.xlsx`);
                onFeedback({ type: 'success', message: 'Đã tải xuống file Excel!' });
                completeProcess(`${outputFileName}.xlsx`, jobs);
            }

        } catch (e: any) {
            onFeedback({ type: 'error', message: `Lỗi xử lý: ${e.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const completeProcess = (path: string, jobs: any[]) => {
         const internalJobs = jobs.map((j: any) => ({
            id: j.JOB_ID,
            prompt: j.PROMPT,
            status: '', // Empty initially
            videoName: j.VIDEO_NAME,
            typeVideo: 'IMG',
            imagePath: j.IMAGE_PATH || '',
            imagePath2: j.IMAGE_PATH_2 || '',
            imagePath3: j.IMAGE_PATH_3 || '',
            imagePath4: j.IMAGE_PATH_4 || '',
            imagePath5: j.IMAGE_PATH_5 || '',
            imagePath6: j.IMAGE_PATH_6 || '',
            imagePath7: j.IMAGE_PATH_7 || '',
            imagePath8: j.IMAGE_PATH_8 || '',
            imagePath9: j.IMAGE_PATH_9 || '',
            imagePath10: j.IMAGE_PATH_10 || '',
        }));
        onProcessingComplete(path, internalJobs);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4">
            <input type="file" ref={folderInputRef} style={{display: 'none'}} 
                // @ts-ignore
                webkitdirectory="" directory="" multiple onChange={handleWebFolderChange} 
            />
            <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".xlsx, .xls" onChange={handleWebExcelChange} />

            <div className="manga-panel p-8 bg-white relative">
                 <div className="absolute -top-4 -left-4 bg-manga-accent text-white px-4 py-1 font-comic border-2 border-black shadow-comic text-xl transform -rotate-2">
                    BƯỚC 1: NHẬP DỮ LIỆU ĐẦU VÀO
                 </div>
                 
                 <div className="space-y-6 mt-4">
                    {/* Character Folder */}
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
                        {charFiles.length > 0 && (
                            <div className="text-xs text-green-600 font-bold flex items-center gap-1">
                                <CheckIcon className="w-4 h-4"/> Tìm thấy {charFiles.length} file ảnh.
                            </div>
                        )}
                    </div>

                    {/* Excel Input */}
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

                    {/* Output Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-dashed border-gray-300">
                        <div className="flex flex-col gap-2">
                            <label className="font-bold uppercase tracking-wider text-sm">3. Tên Ảnh Kết Quả</label>
                            <input 
                                type="text" 
                                value={outputFileName}
                                onChange={(e) => setOutputFileName(e.target.value)}
                                className="border-2 border-black p-3 font-bold"
                                placeholder="VD: Manga_Tap1"
                            />
                            <span className="text-[10px] text-gray-500 italic">* Ảnh sẽ được đặt tên: {outputFileName.replace(/\.xlsx$/i, '')}_1.png, {outputFileName.replace(/\.xlsx$/i, '')}_2.png...</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="font-bold uppercase tracking-wider text-sm">4. Thư mục lưu kết quả</label>
                            <div className="flex gap-2">
                                <div className="flex-1 border-2 border-black p-3 bg-gray-50 font-mono text-xs truncate" title={outputFolderPath}>
                                    {outputFolderPath || 'Mặc định (theo file input)'}
                                </div>
                                <button onClick={handleSelectOutputFolder} className="bg-white border-2 border-black px-3 hover:bg-black hover:text-white transition" title="Chọn thư mục lưu">
                                    <FolderIcon className="w-4 h-4"/>
                                </button>
                                <button onClick={handleCopyOutputFolder} className="bg-white border-2 border-black px-3 hover:bg-manga-accent hover:text-white transition" title="Sao chép đường dẫn">
                                    <CopyIcon className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {previewData.length > 0 && (
                        <div className="mt-4 border-2 border-dashed border-gray-400 p-4 bg-gray-50 max-h-40 overflow-y-auto custom-scrollbar">
                            <p className="text-xs font-bold text-gray-400 mb-2">XEM TRƯỚC DỮ LIỆU:</p>
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="border-b border-gray-300">
                                        <th className="py-2">STT</th>
                                        <th className="py-2">Characters</th>
                                        <th className="py-2">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.slice(0, 5).map((row, i) => (
                                        <tr key={i} className="border-b border-gray-100">
                                            <td className="py-1">{row.stt || i+1}</td>
                                            <td className="py-1 font-bold">{row.Characters}</td>
                                            <td className="py-1 text-gray-600 truncate max-w-xs">{row.Description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                 </div>
            </div>

            <div className="flex justify-center">
                 <button 
                    onClick={processFile}
                    disabled={isProcessing || !charFiles.length || !previewData.length}
                    className="bg-manga-accent text-white font-comic text-2xl px-12 py-4 border-4 border-black shadow-comic hover:shadow-comic-hover hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                 >
                    {isProcessing ? <LoaderIcon /> : 'XỬ LÝ & TẠO JOB'}
                 </button>
            </div>
        </div>
    );
};