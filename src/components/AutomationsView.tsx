import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Bell, 
  Repeat, 
  Calendar,
  X
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

interface AutomationItem {
  id: string;
  title: string;
  triggerType: 'time' | 'countdown' | 'recurring' | 'device_event';
  triggerDetails: string;
  actionSummary: string;
  enabled: boolean;
  lastRun?: any;
}

export function AutomationsView() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [triggerType, setTriggerType] = useState<'time' | 'countdown' | 'recurring' | 'device_event'>('time');
  const [triggerDetails, setTriggerDetails] = useState('');
  const [actionSummary, setActionSummary] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'automations')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AutomationItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...(doc.data() as any) });
      });
      setAutomations(list);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    await addDoc(collection(db, 'users', user.uid, 'automations'), {
      userId: user.uid,
      title: title.trim(),
      triggerType,
      triggerDetails: triggerDetails.trim() || 'Daily at 08:00 AM',
      actionSummary: actionSummary.trim() || 'Provide morning briefing & battery check',
      enabled: true,
      createdAt: serverTimestamp()
    });

    setTitle('');
    setTriggerDetails('');
    setActionSummary('');
    setIsAdding(false);
  };

  const toggleAutomation = async (id: string, current: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'automations', id), {
      enabled: !current
    });
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Are you sure you want to remove this automation?')) return;
    await deleteDoc(doc(db, 'users', user.uid, 'automations', id));
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Automation & Routines</h1>
              <p className="text-sm text-slate-500">Autonomous triggers, scheduled tasks, and device actions orchestrated by Alya.</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Automation
        </button>
      </div>

      {/* Add Form Modal */}
      {isAdding && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Create Authorized Routine</h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Morning Briefing & News"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Trigger Type</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="time">Specific Time (e.g. 08:00 AM)</option>
                  <option value="recurring">Recurring Schedule (Daily/Weekly)</option>
                  <option value="countdown">Countdown Timer</option>
                  <option value="device_event">Device Event (e.g. Low Battery)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Trigger Schedule / Condition</label>
                <input
                  type="text"
                  value={triggerDetails}
                  onChange={(e) => setTriggerDetails(e.target.value)}
                  placeholder="e.g. Every day at 8:00 AM"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Actions to Execute</label>
                <input
                  type="text"
                  value={actionSummary}
                  onChange={(e) => setActionSummary(e.target.value)}
                  placeholder="e.g. Announce weather, set volume to 50%, check battery"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
              >
                Save Automation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Automations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {automations.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 space-y-2">
            <Clock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold">No active automations yet.</p>
            <p className="text-xs text-slate-500">Ask Alya "Set a reminder for..." or click "New Automation" to schedule a routine.</p>
          </div>
        ) : (
          automations.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all ${
                item.enabled 
                  ? 'border-slate-200 dark:border-slate-800 shadow-sm' 
                  : 'border-slate-100 dark:border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-mono uppercase font-bold flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {item.triggerType}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleAutomation(item.id, item.enabled)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      item.enabled ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {item.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</h4>
              <p className="text-xs text-indigo-500 font-mono mt-0.5">{item.triggerDetails}</p>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">{item.actionSummary}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Execution Status:</span>
                <span className={item.enabled ? 'text-emerald-500 font-semibold' : 'text-slate-400'}>
                  {item.enabled ? 'Armed & Listening' : 'Paused'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
