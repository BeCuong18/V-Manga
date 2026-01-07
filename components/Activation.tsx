
import React, { useState, useRef } from 'react';
import { LoaderIcon, CopyIcon, CheckIcon, KeyIcon, LockIcon } from './Icons';

interface ActivationProps {
  machineId: string;
  onActivate: (key: string) => Promise<boolean>;
}

export const Activation: React.FC<ActivationProps> = ({ machineId, onActivate }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const machineIdInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    
    setError('');
    setIsActivating(true);
    const success = await onActivate(key.trim());
    if (!success) {
      setError('Mã kích hoạt không hợp lệ!');
    }
    setIsActivating(false);
  };

  const handleCopy = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      if (machineIdInputRef.current) {
        machineIdInputRef.current.select();
        document.execCommand('copy');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-white overflow-hidden font-comic">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]"></div>
      
      <div className="w-full max-w-lg mx-auto relative z-10">
        {/* Main Card */}
        <div className="bg-white border-4 border-black shadow-[8px_8px_0px_#000] p-8 md:p-10 relative">
          
          {/* Decorative Header Badge */}
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-manga-accent text-white px-6 py-2 border-4 border-black shadow-[4px_4px_0px_#000] rotate-[-2deg] z-20">
            <h2 className="text-xl font-black uppercase tracking-widest whitespace-nowrap">Authentication</h2>
          </div>

          <div className="mt-6 text-center mb-8">
            <h1 className="text-4xl font-display uppercase leading-none mb-2">
              Kích Hoạt <br/><span className="text-stroke-1 text-transparent bg-clip-text bg-black">Phần Mềm</span>
            </h1>
            <p className="text-sm font-bold bg-black text-white inline-block px-2 py-1 transform rotate-1">
              Vui lòng nhập mã bản quyền để tiếp tục
            </p>
          </div>
          
          {/* Machine ID Section */}
          <div className="mb-8 relative group">
            <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-black border-2 border-black z-10 uppercase tracking-wider">
              1. Mã Máy Của Bạn
            </div>
            <div className="flex border-4 border-black bg-gray-50 h-14 relative shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-center w-12 border-r-4 border-black bg-white">
                <LockIcon className="w-6 h-6" />
              </div>
              <input
                ref={machineIdInputRef}
                type="text"
                readOnly
                value={machineId || 'Đang lấy mã...'}
                className="flex-1 bg-transparent border-none text-center font-mono font-bold text-lg focus:ring-0 uppercase text-gray-700"
              />
              <button
                onClick={handleCopy}
                className={`w-14 flex items-center justify-center border-l-4 border-black transition-all hover:bg-black hover:text-white ${copied ? 'bg-black text-white' : 'bg-manga-accent text-white'}`}
                title="Sao chép"
              >
                {copied ? <CheckIcon className="w-6 h-6" /> : <CopyIcon className="w-6 h-6" />}
              </button>
            </div>
            <p className="text-[10px] font-bold text-gray-500 mt-2 text-center uppercase">
              * Gửi mã này cho quản trị viên để nhận Key
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
               <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-black border-2 border-black z-10 uppercase tracking-wider">
                  2. Nhập Key Kích Hoạt
               </div>
               <textarea
                value={key}
                onChange={(e) => setKey(e.target.value)}
                rows={3}
                className="w-full bg-white border-4 border-black p-4 font-mono text-sm font-bold text-black focus:ring-0 focus:shadow-[4px_4px_0px_#000] focus:-translate-y-1 focus:-translate-x-1 transition-all resize-none placeholder-gray-300"
                placeholder="Dán mã kích hoạt tại đây..."
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-100 border-2 border-black p-3 text-red-600 font-bold text-xs uppercase text-center animate-bounce">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isActivating || !machineId}
              className="w-full bg-black text-white font-display text-2xl py-4 border-4 border-black shadow-[6px_6px_0px_#999] hover:shadow-[8px_8px_0px_#000] hover:-translate-y-1 hover:-translate-x-1 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase flex items-center justify-center gap-3 group"
            >
              {isActivating ? <LoaderIcon /> : (
                <>
                  <span>Mở Khóa Ngay</span>
                  <KeyIcon className="w-6 h-6 group-hover:rotate-45 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t-4 border-black border-dashed text-center">
             <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                © 2026 V-Manga Enterprise
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
