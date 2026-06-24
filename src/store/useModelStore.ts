import { create } from 'zustand';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'self-hosted';

interface ModelSettings {
  provider: AIProvider;
  modelName: string;
  privacyMode: boolean;
  maxTokens: number;
  setProvider: (provider: AIProvider) => void;
  setModelName: (name: string) => void;
  setPrivacyMode: (mode: boolean) => void;
}

export const useModelStore = create<ModelSettings>((set) => ({
  provider: 'anthropic',
  modelName: 'claude-3-5-sonnet',
  privacyMode: true,
  maxTokens: 4096,
  setProvider: (provider) => set({ provider }),
  setModelName: (modelName) => set({ modelName }),
  setPrivacyMode: (privacyMode) => set({ privacyMode }),
}));
