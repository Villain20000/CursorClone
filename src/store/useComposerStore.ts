import { create } from 'zustand';

interface ComposerState {
  isOpen: boolean;
  input: string;
  isGenerating: boolean;
  proposedChanges: { fileId: string; newContent: string }[] | null;
  openComposer: () => void;
  closeComposer: () => void;
  setInput: (input: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setProposedChanges: (changes: { fileId: string; newContent: string }[] | null) => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  isOpen: false,
  input: '',
  isGenerating: false,
  proposedChanges: null,
  openComposer: () => set({ isOpen: true }),
  closeComposer: () => set({ isOpen: false, input: '' }),
  setInput: (input) => set({ input }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setProposedChanges: (proposedChanges) => set({ proposedChanges }),
}));
