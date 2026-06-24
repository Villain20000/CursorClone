import { create } from 'zustand';

interface SharedPrompt {
  id: string;
  name: string;
  content: string;
  author: string;
}

interface CollaborationState {
  sharedPrompts: SharedPrompt[];
  addPrompt: (prompt: SharedPrompt) => void;
}

export const useCollaborationStore = create<CollaborationState>((set) => ({
  sharedPrompts: [
    { id: '1', name: 'Refactor to Clean Architecture', content: 'Analyze this file and suggest refactoring...', author: 'Admin' },
    { id: '2', name: 'Add JSDoc Comments', content: 'Add comprehensive JSDoc comments to all functions...', author: 'Dev Lead' }
  ],
  addPrompt: (prompt) => set((state) => ({ sharedPrompts: [...state.sharedPrompts, prompt] })),
}));
