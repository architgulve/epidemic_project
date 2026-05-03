import { useStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';
import { STATE_HEX } from '../utils/colors';

export default function ExpandedAnalytics({ onClose }) {
  const baseline = useStore((s) => s.baseline);
  const scenario = useStore((s) => s.scenario);
  const isComparing = useStore((s) => s.isComparing);
  const nodes = useStore((s) => s.nodes);
  const N = nodes.length;

  const chartData = [];
  for (let d = 0; d < 31; d++) {
    const entry = { day: d };
    if (baseline?.global_totals?.[d]) {
      Object.entries(baseline.global_totals[d]).forEach(([key, val]) => {
        entry[`b_${key}`] = Math.round(val * N);
      });
    }
    if (scenario?.global_totals?.[d]) {
      Object.entries(scenario.global_totals[d]).forEach(([key, val]) => {
        entry[`s_${key}`] = Math.round(val * N);
      });
    }
    chartData.push(entry);
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#050508]/90 backdrop-blur-2xl"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="relative w-full max-w-6xl h-[90vh] bg-[#0a0a0f] rounded-[32px] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Analytical Deep-Dive</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">SEIRD Trajectory Comparison</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10 scrollbar-hide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Baseline Column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Baseline Scenario</span>
                <span className="text-[10px] font-bold text-slate-600 uppercase">Natural Path</span>
              </div>
              <div className="h-[300px] bg-white/[0.02] rounded-3xl border border-white/5 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="day" hide />
                    <YAxis stroke="#475569" fontSize={8} width={30} />
                    <Tooltip 
                        contentStyle={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', padding: '2px 0' }}
                    />
                    <Area type="monotone" dataKey="b_S" stroke={STATE_HEX.S} fill={STATE_HEX.S} fillOpacity={0.03} name="S" isAnimationActive={false} />
                    <Area type="monotone" dataKey="b_E" stroke={STATE_HEX.E} fill={STATE_HEX.E} fillOpacity={0.1} name="E" isAnimationActive={false} />
                    <Area type="monotone" dataKey="b_I" stroke={STATE_HEX.I} fill={STATE_HEX.I} fillOpacity={0.1} name="I" isAnimationActive={false} />
                    <Area type="monotone" dataKey="b_R" stroke={STATE_HEX.R} fill={STATE_HEX.R} fillOpacity={0.1} name="R" isAnimationActive={false} />
                    <Area type="monotone" dataKey="b_D" stroke={STATE_HEX.D} fill={STATE_HEX.D} fillOpacity={0.1} name="D" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Scenario Column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Policy Scenario</span>
                <span className="text-[10px] font-bold text-indigo-500/50 uppercase">Interventions Active</span>
              </div>
              <div className="h-[300px] bg-white/[0.02] rounded-3xl border border-white/5 p-4 relative">
                {!isComparing ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#050508]/60 backdrop-blur-sm z-10 rounded-3xl">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Run Policy Test to Compare</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="day" hide />
                      <YAxis stroke="#475569" fontSize={8} width={30} />
                      <Tooltip 
                          contentStyle={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', padding: '2px 0' }}
                      />
                      <Area type="monotone" dataKey="s_S" stroke={STATE_HEX.S} fill={STATE_HEX.S} fillOpacity={0.03} name="S" isAnimationActive={false} />
                      <Area type="monotone" dataKey="s_E" stroke={STATE_HEX.E} fill={STATE_HEX.E} fillOpacity={0.1} name="E" isAnimationActive={false} />
                      <Area type="monotone" dataKey="s_I" stroke={STATE_HEX.I} fill={STATE_HEX.I} fillOpacity={0.1} name="I" isAnimationActive={false} />
                      <Area type="monotone" dataKey="s_R" stroke={STATE_HEX.R} fill={STATE_HEX.R} fillOpacity={0.1} name="R" isAnimationActive={false} />
                      <Area type="monotone" dataKey="s_D" stroke={STATE_HEX.D} fill={STATE_HEX.D} fillOpacity={0.1} name="D" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryMetric label="Peak Reduction" value={isComparing ? `-${Math.abs(Math.round(( (Math.max(...chartData.map(d => d.b_I || 0))) - (Math.max(...chartData.map(d => d.s_I || 0))) ) / (Math.max(...chartData.map(d => d.b_I || 0)) || 1) * 100))}%` : '--'} color="text-emerald-400" />
            <SummaryMetric label="Total Recovered" value={isComparing ? (Math.round(chartData[30].s_R || 0)).toLocaleString() : '--'} color="text-indigo-400" />
            <SummaryMetric label="Peak Delay" value={isComparing ? `${Math.max(0, chartData.findIndex(d => (d.s_I || 0) === Math.max(...chartData.map(c => c.s_I || 0))) - chartData.findIndex(d => (d.b_I || 0) === Math.max(...chartData.map(c => c.b_I || 0))))} Days` : '--'} color="text-white" />
            <SummaryMetric label="ICU Peak" value={isComparing ? Math.round(Math.max(...chartData.map(d => d.s_I || 0)) * 0.15).toLocaleString() : '--'} color="text-rose-400" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SummaryMetric({ label, value, color }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center">
      <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-lg font-black ${color} tracking-tighter leading-none`}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-center">
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-2xl font-black ${color} tracking-tighter`}>{value}</div>
    </div>
  );
}
