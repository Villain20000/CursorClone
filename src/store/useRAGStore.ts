import { create } from 'zustand';

interface KnowledgeBaseItem {
  id: string;
  title: string;
  url?: string;
  content: string;
  type: 'doc' | 'url' | 'markdown';
}

interface RAGState {
  knowledgeBase: KnowledgeBaseItem[];
  isIndexing: boolean;
  addKnowledge: (item: KnowledgeBaseItem) => void;
  removeKnowledge: (id: string) => void;
  setIndexing: (isIndexing: boolean) => void;
}

export const useRAGStore = create<RAGState>((set) => ({
  knowledgeBase: [
    { id: '1', title: 'Next.js Documentation', type: 'url', content: 'Official docs for Next.js 15...', url: 'https://nextjs.org/docs' }
  ],
  isIndexing: false,
  addKnowledge: (item) => set((state) => ({ knowledgeBase: [...state.knowledgeBase, item] })),
  removeKnowledge: (id) => set((state) => ({ knowledgeBase: state.knowledgeBase.filter(i => i.id !== id) })),
  setIndexing: (isIndexing) => set({ isIndexing }),
}));
