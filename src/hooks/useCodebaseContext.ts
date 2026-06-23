'use client';

import { useEditorStore } from '../store/useEditorStore';

export const useCodebaseContext = () => {
  const { files } = useEditorStore();

  const getFullContext = () => {
    // Collect all file contents into a single string
    let context = "CODEBASE CONTEXT:\n\n";

    // Naive truncation to avoid hitting context limits too hard
    const MAX_FILE_SIZE = 5000;

    Object.values(files).forEach(file => {
      if (file.type === 'file') {
        let content = file.content || '';
        if (content.length > MAX_FILE_SIZE) {
          content = content.substring(0, MAX_FILE_SIZE) + "\n... [TRUNCATED]";
        }
        context += `FILE: ${file.name}\n`;
        context += `CONTENT:\n${content}\n`;
        context += `--- END OF ${file.name} ---\n\n`;
      }
    });

    // Check for .cursorrules
    const cursorRules = Object.values(files).find(f => f.name === '.cursorrules');
    if (cursorRules) {
      context += `PROJECT RULES (.cursorrules):\n${cursorRules.content}\n\n`;
    }

    return context;
  };

  return { getFullContext };
};
