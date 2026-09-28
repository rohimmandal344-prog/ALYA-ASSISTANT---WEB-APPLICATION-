import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { motion } from 'motion/react';
import { Bot, LogIn } from 'lucide-react';

export function LoginView() {
  const { login } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 text-center"
      >
        <div className="flex items-center justify-center w-16 h-16 bg-slate-900 dark:bg-white rounded-2xl mx-auto mb-6">
          <Bot className="w-8 h-8 text-white dark:text-slate-900" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2 tracking-tight">Alya Assistant</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          Your production-ready personal assistant, everywhere.
        </p>

        <button
          onClick={login}
          className="flex items-center justify-center w-full gap-3 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-2xl font-semibold transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
        >
          <LogIn className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
