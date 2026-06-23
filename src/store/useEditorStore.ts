import { create } from 'zustand';
import { EditorState, FileNode } from '@/types';

export const useEditorStore = create<EditorState>((set) => ({
  files: {
    'root': { id: 'root', name: 'root', type: 'folder', children: ['file1', 'file2', 'rules'] },
    'file1': { id: 'file1', name: 'app.js', type: 'file', content: '// Welcome to Cursor Clone\nconsole.log("Hello World");', parentId: 'root', gitStatus: 'modified' },
    'file2': { id: 'file2', name: 'styles.css', type: 'file', content: 'body { background: #1e1e1e; color: white; }', parentId: 'root' },
    'rules': { id: 'rules', name: '.cursorrules', type: 'file', content: 'Preferred language: TypeScript\nAlways use functional components.', parentId: 'root', gitStatus: 'added' },
  },
  openFileIds: [],
  activeFileId: null,

  setFiles: (files) => set({ files }),

  openFile: (fileId) => set((state) => ({
    openFileIds: state.openFileIds.includes(fileId)
      ? state.openFileIds
      : [...state.openFileIds, fileId],
    activeFileId: fileId,
  })),

  closeFile: (fileId) => set((state) => {
    const newOpenFileIds = state.openFileIds.filter((id) => id !== fileId);
    let newActiveFileId = state.activeFileId;
    if (state.activeFileId === fileId) {
      newActiveFileId = newOpenFileIds.length > 0 ? newOpenFileIds[newOpenFileIds.length - 1] : null;
    }
    return {
      openFileIds: newOpenFileIds,
      activeFileId: newActiveFileId,
    };
  }),

  setActiveFile: (fileId) => set({ activeFileId: fileId }),

  updateFileContent: (fileId, content) => set((state) => ({
    files: {
      ...state.files,
      [fileId]: { ...state.files[fileId], content },
    },
  })),
}));
