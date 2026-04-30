import { useStore } from './store';
import UploadView from './components/UploadView.jsx';
import GraphView from './components/GraphView.jsx';
import MapView from './components/MapView.jsx';
import Timeline from './components/Timeline.jsx';
import StatsSidebar from './components/StatsSidebar.jsx';
import AnalyticsPanel from './components/AnalyticsPanel.jsx';
import InterventionPanel from './components/InterventionPanel.jsx';
import VirusLoader from './components/VirusLoader.jsx';
import { AnimatePresence, motion } from 'framer-motion';

const TABS = [
  { key: 'upload', label: 'Upload', icon: '↑' },
  { key: 'graph', label: 'Network Graph', icon: '⊛' },
  { key: 'map', label: 'Map View', icon: '◈' },
];

export default function App() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const isLoading = useStore((s) => s.isLoading);
  const nodes = useStore((s) => s.nodes);
  const hasData = nodes.length > 0;
  const isComparing = useStore((s) => s.isComparing);
  const hasInsights = useStore((s) => !!s.zoneInsights);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050508] overflow-hidden text-slate-100 selection:bg-indigo-500/30">
      {/* ── Top Nav Bar ── */}
      <nav className="flex items-center justify-between px-10 h-20 shrink-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-lg font-black shadow-lg shadow-indigo-500/20">
            E
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-white">
              <span className="text-indigo-400">Epi</span>Scope
            </h1>
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
              Neural ODE Analysis
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-2xl p-1.5 shadow-inner">
          {TABS.map((tab) => {
            const disabled = tab.key !== 'upload' && !hasData;
            return (
              <button
                key={tab.key}
                disabled={disabled}
                onClick={() => !disabled && setActiveView(tab.key)}
                className={`
                  px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2
                  ${activeView === tab.key
                    ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/30'
                    : disabled
                      ? 'text-slate-600 cursor-not-allowed opacity-30'
                      : 'text-white-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="hidden md:flex flex-col items-end">
          <div className="text-xs font-bold text-white">
            {hasData ? `${nodes.length.toLocaleString()} Nodes` : 'System Ready'}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${hasData ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {hasData ? (isComparing ? 'Comparison Mode' : 'Live Stream') : 'Awaiting Input'}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col min-h-0 relative p-4 lg:p-6 gap-4">
        <div className="flex flex-1 min-h-0 gap-4">
          {/* Left: Stats or Intervention */}
          <AnimatePresence mode="wait">
            {(hasData || isLoading) && activeView !== 'upload' && (
              <motion.div
                key={hasInsights ? 'intervention' : 'stats'}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="w-[360px] shrink-0 h-full tech-border bg-black/40"
              >
                {hasInsights ? <InterventionPanel /> : <StatsSidebar />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center: Main Visualization */}
          <div className="flex-1 relative min-w-0 h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeView}-${isComparing}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full w-full"
              >
                <div className={`h-full w-full ${activeView !== 'upload' ? 'bg-[#08080c] tech-border overflow-hidden shadow-2xl' : ''}`}>
                  {activeView === 'upload' && <UploadView />}
                  {(activeView === 'graph' || (activeView === 'graph' && isLoading)) && (
                    isComparing ? (
                      <div className="grid grid-cols-2 h-full gap-px bg-white/5">
                        <GraphView source="baseline" />
                        <GraphView source="scenario" />
                      </div>
                    ) : (
                      <GraphView source="active" />
                    )
                  )}
                  {activeView === 'map' && hasData && (
                    isComparing ? (
                      <div className="grid grid-cols-2 h-full gap-px bg-white/5">
                        <MapView source="baseline" />
                        <MapView source="scenario" />
                      </div>
                    ) : (
                      <MapView source="baseline" />
                    )
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: Medical Analytics */}
          <AnimatePresence mode="wait">
            {(hasData || isLoading) && activeView !== 'upload' && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="w-[380px] shrink-0 h-full tech-border bg-black/40"
              >
                <AnalyticsPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom: Timeline */}
        <AnimatePresence>
          {(hasData || isLoading) && activeView !== 'upload' && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="h-28 shrink-0"
            >
              <Timeline />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Loading Overlay ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050508]/90 backdrop-blur-3xl"
          >
            <VirusLoader />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
