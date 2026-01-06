
export const isElectron = (): boolean => {
    return typeof window !== 'undefined' && 
           !!(window as any).process && 
           (window as any).process.type === 'renderer';
};

export const getIpcRenderer = () => {
    if (isElectron() && (window as any).require) {
        return (window as any).require('electron').ipcRenderer;
    }
    return null;
};
