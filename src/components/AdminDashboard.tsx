'use client';

import { useEnterpriseStore } from '@/store/useEnterpriseStore';
import { Shield, Clock, User, BarChart3, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const { logs, role } = useEnterpriseStore();

  return (
    <div className="flex-1 bg-[#1e1e1e] text-[#cccccc] p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="text-purple-500" />
              Enterprise Admin
            </h1>
            <p className="text-[#858585] text-sm">Overview of team AI usage and audit logs</p>
          </div>
          <div className="bg-[#2d2d2d] px-3 py-1 rounded text-xs border border-[#3c3c3c]">
            Role: <span className="text-white capitalize">{role}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard icon={Activity} label="AI Acceptance" value="84%" color="text-green-500" />
          <StatCard icon={BarChart3} label="Tokens Used" value="1.2M" color="text-blue-500" />
          <StatCard icon={User} label="Active Users" value="12" color="text-purple-500" />
        </div>

        <section className="bg-[#252526] border border-[#333] rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-[#333] bg-[#2d2d2d] font-semibold text-sm">
            Audit Logs (Latest)
          </div>
          <div className="divide-y divide-[#333]">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-[#858585] text-sm">No recent activity</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="p-4 flex items-start gap-4 hover:bg-[#2a2d2e] transition-colors">
                  <div className="bg-[#333] p-2 rounded">
                    <Clock size={16} className="text-[#858585]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-white">{log.action}</span>
                      <span className="text-[10px] text-[#858585]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs text-[#858585] truncate">
                      User: <span className="text-[#d4d4d4]">{log.user}</span> • {log.details}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-[#252526] border border-[#333] p-5 rounded-xl flex items-center gap-4">
      <div className={cn("p-3 rounded-lg bg-[#2d2d2d]", color)}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-[10px] uppercase font-bold text-[#858585] tracking-widest">{label}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
