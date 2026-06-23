import { create } from 'zustand';

interface ComposerState {
  isOpen: boolean;
  input: string;
  isGenerating: boolean;
  proposedChanges: { fileId: string; newContent: string }[] | null;
  mentions: string[];
  openComposer: () => void;
  closeComposer: () => void;
  setInput: (input: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setProposedChanges: (changes: { fileId: string; newContent: string }[] | null) => void;
  addMention: (fileId: string) => void;
  removeMention: (fileId: string) => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  isOpen: false,
  input: '',
  isGenerating: false,
  proposedChanges: null,
  mentions: [],
  openComposer: () => set({ isOpen: true }),
  closeComposer: () => set({ isOpen: false, input: '', mentions: [] }),
  setInput: (input) => set({ input }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setProposedChanges: (proposedChanges) => set({ proposedChanges }),
  addMention: (fileId) => set((state) => ({
    mentions: state.mentions.includes(fileId) ? state.mentions : [...state.mentions, fileId]
  })),
  removeMention: (fileId) => set((state) => ({
    mentions: state.mentions.filter(id => id !== fileId)
  })),
}));
