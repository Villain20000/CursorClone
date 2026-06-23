export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  parentId?: string;
  children?: string[]; // IDs of children
}

export interface EditorState {
  files: Record<string, FileNode>;
  openFileIds: string[];
  activeFileId: string | null;

  // Actions
  setFiles: (files: Record<string, FileNode>) => void;
  openFile: (fileId: string) => void;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string | null) => void;
  updateFileContent: (fileId: string, content: string) => void;
}
