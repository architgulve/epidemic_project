import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { STATE_HEX } from '../utils/colors';

import { Play, Pause } from 'lucide-react';

export default function Timeline() {
  const currentDay = useStore((s) => s.currentDay);
  const setCurrentDay = useStore((s) => s.setCurrentDay);
  const isPlaying = useStore((s) => s.isPlaying);
  const togglePlay = useStore((s) => s.togglePlay);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);
  const nodes = useStore((s) => s.nodes);
  const isComparing = useStore((s) => s.isComparing);
  const baseline = useStore((s) => s.baseline);
  
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const fractionalDay = useRef(0);

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    fractionalDay.current = currentDay;
    const tick = (timestamp) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      fractionalDay.current += dt * playbackSpeed;

      if (fractionalDay.current >= 29) {
        setCurrentDay(29);
        useStore.getState().setIsPlaying(false);
        return;
      }
      setCurrentDay(Math.floor(fractionalDay.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, playbackSpeed]);

  const aggregates = useRef([]);
  const baselineAggregates = useRef([]);

  const computeAggregates = (nodeList) => {
    if (!nodeList || !nodeList.length) return [];
    const agg = [];
    for (let d = 0; d < 30; d++) {
      const totals = { S: 0, E: 0, I: 0, R: 0, D: 0 };
      nodeList.forEach(n => {
        if (!n.days[d]) return;
        totals.S += n.days[d].S;
        totals.E += n.days[d].E;
        totals.I += n.days[d].I;
        totals.R += n.days[d].R;
        totals.D += n.days[d].D;
      });
      const N = nodeList.length;
      agg.push({ S: totals.S / N, E: totals.E / N, I: totals.I / N, R: totals.R / N, D: totals.D / N });
    }
    return agg;
  };

  useEffect(() => {
    aggregates.current = computeAggregates(nodes);
  }, [nodes]);

  useEffect(() => {
    if (isComparing && baseline) {
      baselineAggregates.current = computeAggregates(baseline.nodes);
    }
  }, [isComparing, baseline]);

  const handleScrub = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const day = Math.round(pct * 29);
    setCurrentDay(day);
    fractionalDay.current = day;
  }, [setCurrentDay]);

  const speeds = [0.5, 1, 2, 4];

  const renderAreaChart = (aggData, opacity = 0.4, isOutline = false) => (
    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
      {aggData.length > 0 && ['D', 'R', 'I', 'E', 'S'].map((state) => {
        const pts = aggData.map((a, i) => {
          const x = (i / 29) * 100;
          let y0 = 0;
          const order = ['S', 'E', 'I', 'R', 'D'];
          for (const s of order) {
            if (s === state) break;
            y0 += a[s];
          }
          const y1 = y0 + a[state];
          return { x, y0: (1 - y0) * 100, y1: (1 - y1) * 100 };
        });
        const top = pts.map(p => `${p.x},${p.y1}`).join(' ');
        const bottom = [...pts].reverse().map(p => `${p.x},${p.y0}`).join(' ');
        
        return (
          <polygon
            key={state}
            points={`${top} ${bottom}`}
            fill={isOutline ? 'transparent' : (state === 'D' ? '#fff' : STATE_HEX[state])}
            stroke={isOutline ? (state === 'D' ? '#fff' : STATE_HEX[state]) : 'transparent'}
            strokeWidth={isOutline ? 0.5 : 0}
            style={{ opacity: isOutline ? 0.3 : opacity }}
          />
        );
      })}
    </svg>
  );

  return (
    <div className="h-full w-full bg-[#08080c] flex items-center px-8 gap-8 border border-white/5 tech-border overflow-hidden relative">
      {/* Background Area Chart (Current) */}
      <div className="absolute inset-x-8 inset-y-2 pointer-events-none">
        {renderAreaChart(aggregates.current)}
      </div>

      {/* Ghost Area Chart (Baseline) */}
      {isComparing && (
        <div className="absolute inset-x-8 inset-y-2 pointer-events-none">
          {renderAreaChart(baselineAggregates.current, 0.1, true)}
        </div>
      )}

      {/* Controls Group */}
      <div className="flex items-center gap-3 z-10">
        <button
          onClick={togglePlay}
          className="w-10 h-10 border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center
                     transition-all active:scale-90"
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>

        <button
          onClick={() => {
            const idx = speeds.indexOf(playbackSpeed);
            setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
          }}
          className="text-[9px] font-black px-3 py-2 border border-white/10 bg-black
                     text-slate-400 hover:text-white transition-all uppercase tracking-widest"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Track */}
      <div className="flex-1 relative h-16 cursor-pointer group z-10" onMouseDown={(e) => {
        handleScrub(e);
        const move = (ev) => handleScrub(ev);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}>
        {/* Track line */}
        <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-white/10" />

        {/* Tick marks */}
        {[0, 5, 10, 15, 20, 25, 29].map((d) => (
          <div key={d} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${(d / 29) * 100}%` }}>
            <div className="w-px h-2 bg-white/20 mx-auto" />
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7px] text-slate-600 font-black">D.{d+1}</span>
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-75"
          style={{ left: `${(currentDay / 29) * 100}%` }}
        >
          <div className="w-0.5 h-12 bg-white shadow-[0_0_10px_#fff]" />
          <div className="absolute -top-12 left-1/2 -translate-x-1/2
                          bg-white text-black text-[9px] font-black uppercase tracking-widest
                          px-2 py-1 whitespace-nowrap shadow-2xl">
            DAY {currentDay + 1}
          </div>
        </div>
      </div>

      {/* Day display */}
      <div className="text-right min-w-[100px] shrink-0 z-10 pl-4 border-l border-white/5">
        <div className="text-2xl font-black font-mono leading-none text-white tracking-tighter">DAY {currentDay + 1}</div>
        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">CHRONO::STREAM</div>
      </div>
    </div>
  );
}
