
export type VideoType = 'story' | 'in2v' | 'IMG'; 
export type ActiveTab = 'generator' | 'tracker'; 
export type JobStatus = '' | 'Pending' | 'Processing' | 'Generating' | 'Completed' | 'Failed';

export interface VideoJob {
    id: string;
    prompt: string;
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
    lastUpdated?: number;
}
  
export interface TrackedFile {
  name: string;
  jobs: VideoJob[];
  path?: string;
  targetDurationSeconds?: number;
}

export interface AppConfig {
  machineId: string;
  licenseKey?: string; 
  isActivated: boolean;
}

export interface StatsData {
  machineId: string;
  total: number;
  promptCount: number;
  totalCredits: number;
  history: { date: string; count: number }[];
  // Added to track model usage quotas per API key
  modelUsage?: Record<string, Record<string, number>>;
}

// Added missing Scene interface for Results component
export interface Scene {
  scene_number: number;
  scene_title: string;
  prompt_text: string;
}

// Added missing ApiKey interface for ApiKeyManager component
export interface ApiKey {
  id: string;
  name: string;
  value: string;
}
