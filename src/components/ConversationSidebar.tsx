import React, { useState } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Search, 
  Edit2, 
  Check, 
  X, 
  Clock, 
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { ConversationSession } from '../services/conversationService';

interface ConversationSidebarProps {
  conversations: ConversationSession[];
  currentConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAllConversations?: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onClearAllConversations,
  isOpen,
  onToggle,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      alert('You must have at least one conversation session.');
      return;
    }
    if (!confirm('Are you sure you want to delete this conversation session?')) return;
    onDeleteConversation(id);
  };

  const handleStartRename = (e: React.MouseEvent, conv: ConversationSession) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const filteredConversations = conversations.filter(c => 
    (c.title || 'Conversation').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp?: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onToggle}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'}
        fixed md:relative inset-y-0 left-0 z-30
        flex flex-col bg-slate-50 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800
        transition-all duration-300 ease-in-out shrink-0
      `}>
        {/* Header / New Chat Button */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              History
            </span>
            <button 
              onClick={onToggle}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => !isEditing && onSelectConversation(conv.id)}
                  className={`
                    group relative flex items-center justify-between p-3 rounded-2xl text-xs font-medium cursor-pointer transition-all
                    ${isActive 
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-700 font-semibold' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(e as any, conv.id)}
                        className="flex-1 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-xs outline-none border border-slate-300 dark:border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="truncate flex-1">
                        <p className="truncate">{conv.title}</p>
                        {conv.updatedAt && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            {formatDate(conv.updatedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action icons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button
                          onClick={(e) => handleSaveRename(e, conv.id)}
                          className="p-1 hover:text-emerald-500"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                          className="p-1 hover:text-slate-500"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleStartRename(e, conv)}
                          className="p-1 text-slate-400 hover:text-indigo-500 rounded"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Clear Chat History Action Button */}
        {conversations.length > 0 && onClearAllConversations && (
          <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete ALL chat sessions? This action is permanent.')) {
                  onClearAllConversations();
                }
              }}
              className="w-full py-2.5 px-4 border border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Chat History
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            Sessions Synced
          </span>
          <span className="font-mono text-[10px]">{conversations.length} total</span>
        </div>
      </aside>
    </>
  );
}
