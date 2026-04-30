import { useCallback, useState } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

export default function UploadView() {
  const file = useStore((s) => s.file);
  const setFile = useStore((s) => s.setFile);
  const interventions = useStore((s) => s.interventions);
  const setInterventions = useStore((s) => s.setInterventions);
  const uploadAndPredict = useStore((s) => s.uploadAndPredict);
  const error = useStore((s) => s.error);
  const loading = useStore((s) => s.loading);

  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
  }, [setFile]);

  const handleFileInput = useCallback((e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  }, [setFile]);

  return (
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
        
        {/* Floating Particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/10 rounded-full"
            initial={{ x: Math.random() * 100 + '%', y: Math.random() * 100 + '%' }}
            animate={{ y: [null, '-10%', '10%'], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 10 + Math.random() * 5, repeat: Infinity }}
          />
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-12"
      >
        {/* Left Column: Title & Upload */}
        <div className="lg:col-span-3 flex flex-col justify-center">
          <div className="mb-12">
            <h1 className="text-7xl font-black mb-6 tracking-tighter leading-none text-white">
              <span className="text-indigo-400">Epi</span>Scope
            </h1>
            <p className="text-xl text-slate-400 max-w-xl leading-relaxed font-medium">
              Advanced Neural ODE forecasting engine. Upload your population nodes to predict transmission dynamics at scale.
            </p>
          </div>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              relative group cursor-pointer transition-all duration-500
              aspect-video w-full max-w-2xl rounded-[40px] border-2 border-dashed
              flex flex-col items-center justify-center p-12 overflow-hidden
              ${dragOver 
                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' 
                : file 
                  ? 'border-emerald-500/30 bg-emerald-500/5' 
                  : 'border-white/10 hover:border-indigo-500/50 bg-white/5'}
            `}
          >
            <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
            
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                  <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/10">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">{file.name}</div>
                  <div className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Dataset Prepared</div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                  <div className="w-20 h-20 bg-white/5 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-all duration-500 border border-white/5">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <div className="text-3xl font-black text-white mb-3 tracking-tight">Drop Population Data</div>
                  <div className="text-slate-500 font-bold">CSV with <span className="text-indigo-400 font-mono">node_id</span> and <span className="text-indigo-400 font-mono">infected</span></div>
                </motion.div>
              )}
            </AnimatePresence>
          </label>
        </div>

        {/* Right Column: Configuration */}
        <div className="lg:col-span-2">
          <div className="bg-[#0a0a0f]/60 backdrop-blur-3xl rounded-[40px] p-10 h-full flex flex-col shadow-2xl border border-white/10">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black flex items-center gap-3 text-white">
                <span className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center text-lg shadow-inner">⚙</span>
                Config
              </h3>
            </div>

            <div className="space-y-10 flex-grow">
              <div className="space-y-5">
                <div className="flex justify-between items-end">
                  <div className="text-sm font-black text-white uppercase tracking-widest">Mask Mandate</div>
                  <span className="text-indigo-400 font-mono font-black text-lg">{interventions.mask_mandate}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={interventions.mask_mandate}
                  onChange={(e) => setInterventions({ mask_mandate: Number(e.target.value) })}
                  className="w-full accent-indigo-500 h-2 bg-white/5 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  { id: 'school_closure', label: 'School Closure', icon: '🏫' },
                  { id: 'lockdown', label: 'Strict Lockdown', icon: '🔒' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setInterventions({ [item.id]: !interventions[item.id] })}
                    className={`
                      relative p-5 rounded-[24px] text-left transition-all duration-300 border-2 flex items-center gap-5
                      ${interventions[item.id] 
                        ? 'bg-indigo-500/10 border-indigo-500/50 text-white' 
                        : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}
                    `}
                  >
                    <div className="text-3xl">{item.icon}</div>
                    <div className="font-black text-sm uppercase tracking-wide">{item.label}</div>
                    {interventions[item.id] && <div className="ml-auto w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={!file || loading}
              onClick={uploadAndPredict}
              className={`
                mt-12 w-full py-6 rounded-[24px] font-black text-xl flex items-center justify-center gap-4 transition-all duration-500
                ${file && !loading
                  ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-2xl shadow-indigo-500/40 hover:scale-[1.02]'
                  : 'bg-white/5 text-slate-700 cursor-not-allowed'}
              `}
            >
              {loading ? "Analyzing..." : "🚀 Run Simulation"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
