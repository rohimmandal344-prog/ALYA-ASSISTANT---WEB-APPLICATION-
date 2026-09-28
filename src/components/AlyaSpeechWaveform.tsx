import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Volume2, Square, Sparkles, Activity } from 'lucide-react';

interface AlyaSpeechWaveformProps {
  isPlaying: boolean;
  onStop?: () => void;
  variant?: 'inline' | 'expanded' | 'floating';
  barCount?: number;
}

export function AlyaSpeechWaveform({
  isPlaying,
  onStop,
  variant = 'inline',
  barCount = 28
}: AlyaSpeechWaveformProps) {
  const [bars, setBars] = useState<number[]>(new Array(barCount).fill(15));
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      setBars(new Array(barCount).fill(15));
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let phase = 0;

    const animate = () => {
      phase += 0.08;
      const newBars = [];

      for (let i = 0; i < barCount; i++) {
        // Multi-frequency harmonic simulation mimicking human voice prosody
        const wave1 = Math.sin(phase + i * 0.35);
        const wave2 = Math.cos(phase * 1.5 + i * 0.2);
        const wave3 = Math.sin(phase * 0.5 + i * 0.8);
        
        // Bell-curve center amplification for natural vocal spectrum distribution
        const centerDistance = Math.abs(i - barCount / 2) / (barCount / 2);
        const bellWeight = Math.max(0.3, 1 - centerDistance * 0.6);

        // Combined normalized height (15% to 95%)
        const combined = (Math.abs(wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * 80 + 15) * bellWeight;
        newBars.push(Math.min(95, Math.max(15, combined)));
      }

      setBars(newBars);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, barCount]);

  if (!isPlaying && variant === 'floating') return null;

  if (variant === 'expanded') {
    return (
      <div className="p-4 bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-indigo-950/80 rounded-2xl border border-indigo-500/30 backdrop-blur-md shadow-lg shadow-indigo-500/10 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-white flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Alisa (Alya) is Vocalizing...
            </span>
          </div>

          {onStop && (
            <button
              onClick={onStop}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>

        {/* Dynamic Spectrum Waveform */}
        <div className="h-10 flex items-center justify-center gap-1 px-2">
          {bars.map((height, idx) => (
            <motion.div
              key={idx}
              animate={{ height: `${height}%` }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-1.5 rounded-full bg-gradient-to-t from-indigo-500 via-violet-400 to-pink-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"
            />
          ))}
        </div>
      </div>
    );
  }

  // Inline Waveform for Chat Message Bubble
  return (
    <div className="flex items-center gap-2 p-2 bg-indigo-50/80 dark:bg-indigo-950/50 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/60 transition-all">
      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 shrink-0 px-1">
        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
        <span className="text-[11px] font-bold">Alya Speaking</span>
      </div>

      {/* Spectrum Waveform Bars */}
      <div className="flex-1 h-6 flex items-center justify-center gap-0.5 px-1 min-w-[120px] max-w-[200px]">
        {bars.slice(0, 18).map((height, idx) => (
          <div
            key={idx}
            style={{ height: `${height}%` }}
            className="w-1 rounded-full bg-gradient-to-t from-indigo-600 to-violet-400 dark:from-indigo-400 dark:to-pink-400 transition-all duration-75"
          />
        ))}
      </div>

      {onStop && (
        <button
          onClick={onStop}
          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0"
          title="Stop playback"
        >
          <Square className="w-2.5 h-2.5 fill-current" />
          <span>Stop</span>
        </button>
      )}
    </div>
  );
}
