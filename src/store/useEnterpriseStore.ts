import { create } from 'zustand';

interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

interface EnterpriseState {
  logs: AuditLog[];
  role: 'admin' | 'editor' | 'viewer';
  addLog: (action: string, details: string) => void;
  setRole: (role: 'admin' | 'editor' | 'viewer') => void;
}

export const useEnterpriseStore = create<EnterpriseState>((set) => ({
  logs: [],
  role: 'admin',
  addLog: (action, details) => set((state) => ({
    logs: [{
      timestamp: new Date().toISOString(),
      user: 'Current User',
      action,
      details
    }, ...state.logs].slice(0, 50)
  })),
  setRole: (role) => set({ role }),
}));
