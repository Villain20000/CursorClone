'use client';

import { Editor as MonacoEditor, OnMount } from '@monaco-editor/react';
import { useEditorStore } from '@/store/useEditorStore';
import { useRef } from 'react';

export default function Editor() {
  const { activeFileId, files, updateFileContent } = useEditorStore();
  const editorRef = useRef<any>(null);

  const activeFile = activeFileId ? files[activeFileId] : null;

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme('cursor-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#2a2d2e',
      }
    });
    monaco.editor.setTheme('cursor-dark');

    monaco.languages.registerInlineCompletionsProvider('javascript', {
      provideInlineCompletions: async (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        if (position.column <= lineContent.length) return;
        return {
          items: [
            {
              insertText: ' // AI suggested code here',
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            },
          ],
        };
      },
      freeInlineCompletions: () => {},
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFileId && value !== undefined) {
      updateFileContent(activeFileId, value);
    }
  };

  if (!activeFile) return <div className="flex-1 flex items-center justify-center text-[#858585]">No file selected</div>;

  const getLanguage = (fileName: string) => {
    const ext = fileName.split('.').pop();
    switch (ext) {
      case 'js': return 'javascript';
      case 'ts': case 'tsx': return 'typescript';
      case 'css': return 'css';
      default: return 'plaintext';
    }
  };

  return (
    <div className="flex-1 overflow-hidden relative">
      <MonacoEditor
        height="100%"
        language={getLanguage(activeFile.name)}
        value={activeFile.content}
        theme="cursor-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: "'JetBrains Mono', monospace",
        }}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
      />
    </div>
  );
}
