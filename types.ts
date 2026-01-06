
export type MvGenre = 'narrative'; // Giữ lại cho tương thích code cũ nếu cần, nhưng không dùng
export type VideoType = 'story' | 'in2v' | 'IMG'; // Thêm IMG
export type ActiveTab = 'generator' | 'tracker'; // Bỏ api-manager
export type JobStatus = '' | 'Pending' | 'Processing' | 'Generating' | 'Completed' | 'Failed';

export interface ApiKey {
  id: string;
  name: string;
  value: string;
}

export interface Scene {
  scene_number: number;
  scene_title: string;
  prompt_text: string;
}

export interface UploadedImage {
  base64: string;
  mimeType: string;
  name: string;
  path?: string;
}

// Giữ FormData để tránh lỗi build ở các component cũ chưa xóa hết, nhưng thực tế ít dùng
export interface FormData {
  projectName: string;
}

export interface VideoJob {
    id: string;
    prompt: string;
    // Hỗ trợ tối đa 10 ảnh tham chiếu
    imagePath: string;
    imagePath2: string;
    imagePath3: string;
    imagePath4?: string;
    imagePath5?: string;
    imagePath6?: string;
    imagePath7?: string;
    imagePath8?: string;
    imagePath9?: string;
    imagePath10?: string;
    
    status: JobStatus;
    videoName: string;
    typeVideo: string;
    videoPath?: string;
    lastUpdated?: number; // Timestamp for stuck detection
}
  
export interface TrackedFile {
  name: string;
  jobs: VideoJob[];
  path?: string;
  targetDurationSeconds?: number;
}

export interface AppConfig {
  machineId?: string;
  // Bỏ licenseKey, apiKey
  lastFolder?: string;
  toolFlowPath?: string;
}

export interface DailyStats {
    date: string;
    count: number;
}

export interface StatsData {
    machineId: string;
    history: DailyStats[];
    total: number;
    promptCount?: number;
    totalCredits?: number;
    modelUsage?: Record<string, Record<string, number>>;
}
