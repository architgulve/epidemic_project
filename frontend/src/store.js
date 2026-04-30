import { create } from 'zustand';
import { uploadDataset } from './utils/api';

export const useStore = create((set, get) => ({
  // --- View ---
  activeView: 'upload', 
  setActiveView: (v) => set({ activeView: v }),
  isComparing: false,
  setIsComparing: (v) => set({ isComparing: v }),

  // --- Upload ---
  file: null,
  graphId: null,
  nNodes: 0,
  nInfected: 0,
  setFile: (f) => set({ file: f }),

  // --- Interventions ---
  interventions: { mask_mandate: 0, school_closure: false, lockdown: false },
  zoneInterventions: {}, // { zoneId: { lockdown, mask_mandate } }
  setInterventions: (iv) => set({ interventions: { ...get().interventions, ...iv } }),
  setZoneIntervention: (zoneId, zi) => set((s) => ({
    zoneInterventions: { ...s.zoneInterventions, [zoneId]: { ...(s.zoneInterventions[zoneId] || {}), ...zi } }
  })),

  // --- Prediction Data ---
  baseline: null, // { nodes, zones, edges_src, edges_dst }
  scenario: null,
  zoneInsights: null,
  isLoading: false,
  loadingProgress: 0,
  loadingText: 'Preparing analysis...',
  error: null,

  // --- Computed / Active Data ---
  nodes: [], 
  zones: [],
  edgesSrc: [],
  edgesDst: [],

  // --- Timeline ---
  currentDay: 0,
  isPlaying: false,
  playbackSpeed: 1,
  setCurrentDay: (d) => set({ currentDay: d }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaybackSpeed: (sp) => set({ playbackSpeed: sp }),

  // --- Graph Navigation ---
  currentClusterId: null,
  breadcrumbs: [{ id: null, label: 'All Nodes' }],
  drillInto: (clusterId, label) => set((s) => ({
    currentClusterId: clusterId,
    breadcrumbs: [...s.breadcrumbs, { id: clusterId, label }],
  })),
  navigateTo: (index) => set((s) => ({
    currentClusterId: s.breadcrumbs[index].id,
    breadcrumbs: s.breadcrumbs.slice(0, index + 1),
  })),
  resetNavigation: () => set({
    currentClusterId: null,
    breadcrumbs: [{ id: null, label: 'All Nodes' }],
  }),

  // --- Sync State ---
  graphTransform: { x: 0, y: 0, k: 1 },
  graphHoveredId: null,
  setGraphTransform: (t) => set({ graphTransform: t }),
  setGraphHoveredId: (id) => set({ graphHoveredId: id }),

  // --- Actions ---
  uploadAndPredict: async () => {
    const { file, interventions, zoneInterventions, baseline } = get();
    if (!file) return;

    set({ 
      isLoading: true, 
      error: null, 
      activeView: 'graph',
      loadingProgress: 0, 
      loadingText: 'Initializing simulation engine...' 
    });

    try {
      let gId = get().graphId;
      if (!gId) {
        const uploadResult = await uploadDataset(file);
        gId = uploadResult.graph_id;
        set({ graphId: gId, nNodes: uploadResult.n_nodes, nInfected: uploadResult.n_infected });
      }

      const response = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph_id: gId, interventions, zone_interventions: zoneInterventions }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const msg = JSON.parse(line.replace('data: ', ''));
          if (msg.type === 'progress') set({ loadingProgress: msg.value, loadingText: msg.text });
          else if (msg.type === 'result') {
            const data = msg.data;
            
            // Set global active data immediately
            set({ 
              nodes: data.nodes, 
              zones: data.zones, 
              edgesSrc: data.edges_src || [], 
              edgesDst: data.edges_dst || [],
              isLoading: false, 
              loadingProgress: 100 
            });
            
            if (!baseline) {
              set({ baseline: data, activeView: 'graph' });
              // Background fetch for insights
              fetch(`http://localhost:8000/api/insights/${gId}`)
                .then(r => r.json())
                .then(ins => set({ zoneInsights: ins }))
                .catch(e => console.error('Insights fetch failed', e));
            } else {
              set({ scenario: data, isComparing: true, activeView: 'map' });
            }
            return;
          } else if (msg.type === 'error') throw new Error(msg.message);
        }
      }
      set({ isLoading: false, loadingProgress: 100 });
    } catch (err) {
      console.error('Prediction Error:', err);
      set({ isLoading: false, error: err.message, activeView: 'upload' });
    }
  },
}));
