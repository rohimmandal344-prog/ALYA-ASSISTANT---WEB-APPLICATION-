import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  ShieldCheck, 
  User, 
  Smartphone, 
  Bookmark, 
  CheckCircle, 
  X,
  Sparkles,
  Info
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

interface MemoryItem {
  id: string;
  category: 'preference' | 'fact' | 'device' | 'task';
  key: string;
  value: string;
  createdAt?: any;
}

export function MemoryView() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [newCategory, setNewCategory] = useState<'preference' | 'fact' | 'device' | 'task'>('preference');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'memories')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MemoryItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...(doc.data() as any) });
      });
      setMemories(list);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newKey.trim() || !newValue.trim()) return;

    if (editingId) {
      const docRef = doc(db, 'users', user.uid, 'memories', editingId);
      await updateDoc(docRef, {
        category: newCategory,
        key: newKey.trim(),
        value: newValue.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'users', user.uid, 'memories'), {
        userId: user.uid,
        category: newCategory,
        key: newKey.trim(),
        value: newValue.trim(),
        createdAt: serverTimestamp()
      });
    }

    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  const handleDeleteMemory = async (id: string) => {
    if (!user || !confirm('Are you sure you want Alya to forget this memory?')) return;
    await deleteDoc(doc(db, 'users', user.uid, 'memories', id));
  };

  const handleStartEdit = (m: MemoryItem) => {
    setEditingId(m.id);
    setNewCategory(m.category);
    setNewKey(m.key);
    setNewValue(m.value);
    setIsAdding(true);
  };

  const filteredMemories = memories.filter((m) => {
    const matchesCat = activeCategory === 'all' || m.category === activeCategory;
    const matchesSearch = 
      m.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.value.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Long-Term Memory System</h1>
              <p className="text-sm text-slate-500">Persistent user preferences and facts under strict user ownership & control.</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setNewKey('');
            setNewValue('');
            setIsAdding(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Memory Point
        </button>
      </div>

      {/* Info Notice */}
      <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Alya uses long-term memory to tailor contextual answers, remember important preferences (e.g. preferred units, dietary choices, work schedule), and avoid repetitive questions. You can view, edit, or delete any record at any time.
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search recalled memories..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'preference', 'fact', 'device', 'task'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {isAdding && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              {editingId ? 'Edit Memory Entry' : 'Store New Memory Entry'}
            </h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveMemory} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="preference">User Preference</option>
                  <option value="fact">Important Fact</option>
                  <option value="device">Device Memory</option>
                  <option value="task">Task Memory</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Topic / Key</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. coffee_preference, working_hours"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Information / Value</label>
                <textarea
                  rows={2}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g. Prefers dark roast with oat milk; work starts at 9:00 AM."
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
                {editingId ? 'Save Changes' : 'Store Memory'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Memory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMemories.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 space-y-2">
            <Bookmark className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold">No memories recorded yet.</p>
            <p className="text-xs text-slate-500">Tell Alya "Remember that..." in chat or click "Add Memory Point" above.</p>
          </div>
        ) : (
          filteredMemories.map((m) => (
            <div
              key={m.id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-mono uppercase font-bold">
                    {m.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(m)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">{m.key}</h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{m.value}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>Verified in Alya Brain</span>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Active
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
