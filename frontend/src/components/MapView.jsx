import { useRef, useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../store';
import { getSeverityColor, getNodeColor } from '../utils/colors';

// Pune center
const CENTER = [18.52, 73.86];
const NODE_ZOOM_THRESHOLD = 11;

export default function MapView({ source = 'baseline' }) {
  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 right-4 z-[400] bg-[#0a0a0f]/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${source === 'baseline' ? 'bg-slate-400' : 'bg-indigo-400 animate-pulse'}`} />
        {source}
      </div>
      <MapContainer
        center={CENTER}
        zoom={12}
        className="w-full h-full"
        zoomControl={source === 'baseline'}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <HeatmapOverlay source={source} />
        <NodeMarkers source={source} />
        <SyncMap />
      </MapContainer>
    </div>
  );
}

function SyncMap() {
  const map = useMap();
  // We can add cross-map synchronization here if desired
  return null;
}

/* ───── Heatmap Canvas Overlay ───── */
function HeatmapOverlay({ source }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const data = useStore((s) => s[source]);
  const zones = data?.zones || [];
  const currentDay = useStore((s) => s.currentDay);

  useEffect(() => {
    // Create a custom canvas layer
    const CanvasLayer = L.Layer.extend({
      onAdd: function(map) {
        this._container = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer');
        this._container.style.pointerEvents = 'none';
        this._container.style.zIndex = 300;
        map.getPanes().overlayPane.appendChild(this._container);
        this._map = map;
        this._draw();
        map.on('moveend zoomend viewreset', this._draw, this);
      },
      onRemove: function(map) {
        map.getPanes().overlayPane.removeChild(this._container);
        map.off('moveend zoomend viewreset', this._draw, this);
      },
      _draw: function() {
        if (!this._container || !this._map) return;
        const canvas = this._container;
        const ctx = canvas.getContext('2d');
        const size = this._map.getSize();
        canvas.width = size.x;
        canvas.height = size.y;
        
        const panePos = L.DomUtil.getPosition(this._map.getPanes().mapPane);
        L.DomUtil.setPosition(canvas, { x: -panePos.x, y: -panePos.y });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Weather Map Palette (Spectral) - Boosted Sensitivity
        const paletteCanvas = document.createElement('canvas');
        paletteCanvas.width = 1;
        paletteCanvas.height = 256;
        const pCtx = paletteCanvas.getContext('2d');
        const gradient = pCtx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0.01, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.1, 'rgba(0, 100, 255, 0.5)'); 
        gradient.addColorStop(0.2, 'rgb(0, 255, 255)');      
        gradient.addColorStop(0.35, 'rgb(50, 255, 50)');       
        gradient.addColorStop(0.5, 'rgb(255, 255, 0)');      
        gradient.addColorStop(0.7, 'rgb(255, 60, 0)');        
        gradient.addColorStop(1.0, 'rgb(255, 30, 30)');        // VIBRANT RED (NO DARK BORDER)
        pCtx.fillStyle = gradient;
        pCtx.fillRect(0, 0, 1, 256);
        const palette = pCtx.getImageData(0, 0, 1, 256).data;

        // 2. Draw blurred intensity mass
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = `blur(${Math.max(8, 12 * (this._map.getZoom() / 12))}px)`;
        
        zones.forEach((z) => {
          const severity = z.severity[currentDay] || 0;
          if (severity < 0.001) return;

          const point = this._map.latLngToContainerPoint([z.clat, z.clng]);
          const radius = Math.max(40, 140 * severity * (this._map.getZoom() / 11));
          
          // Main plume - BOOSTED WEIGHT
          const g = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
          const weight = Math.min(0.8, severity * 1.5); 
          g.addColorStop(0, `rgba(0, 0, 0, ${weight})`);
          g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // High-Intensity Core - BOOSTED WEIGHT
          const coreRadius = radius * 0.4;
          const cg = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, coreRadius);
          cg.addColorStop(0, `rgba(0, 0, 0, ${Math.min(1, severity * 2.5)})`);
          cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(point.x, point.y, coreRadius, 0, Math.PI * 2);
          ctx.fill();
        });

        // 3. Colorize and Texturize
        ctx.filter = 'none'; 
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const imgData = img.data;
        for (let i = 0; i < imgData.length; i += 4) {
          const alpha = imgData[i + 3];
          if (alpha > 0) {
            const offset = alpha * 4;
            imgData[i] = palette[offset];
            imgData[i + 1] = palette[offset + 1];
            imgData[i + 2] = palette[offset + 2];
            
            const noise = (Math.random() * 8 - 4);
            // REDUCED ALPHA MULTIPLIER FOR TRANSPARENCY
            imgData[i + 3] = Math.max(0, Math.min(255, alpha * 0.7 + noise));
          }
        }
        ctx.putImageData(img, 0, 0);
      }
    });

    const layer = new CanvasLayer();
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, zones, currentDay]);

  return null;
}

/* ───── Individual Node Markers ───── */
function NodeMarkers({ source }) {
  const map = useMap();
  const data = useStore((s) => s[source]);
  const nodes = data?.nodes || [];
  const currentDay = useStore((s) => s.currentDay);
  const layerGroupRef = useRef(null);
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        map.removeLayer(layerGroupRef.current);
      }
    };
  }, [map]);

  const visibleNodes = useMemo(() => {
    if (zoom < NODE_ZOOM_THRESHOLD || !nodes.length) return [];
    const bounds = map.getBounds();
    return nodes.filter((n) =>
      n.lat >= bounds.getSouth() && n.lat <= bounds.getNorth() &&
      n.lng >= bounds.getWest() && n.lng <= bounds.getEast()
    ).slice(0, 400);
  }, [zoom, nodes, map]);

  useEffect(() => {
    const lg = layerGroupRef.current;
    if (!lg) return;
    lg.clearLayers();

    if (zoom < NODE_ZOOM_THRESHOLD) return;

    for (const node of visibleNodes) {
      const state = node.days?.[currentDay];
      if (!state) continue;

      const color = getNodeColor(state);
      const marker = L.circleMarker([node.lat, node.lng], {
        radius: 4,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.8,
      });

      marker.bindTooltip(`Node #${node.id}<br/>I: ${(state.I * 100).toFixed(1)}%`, {
        className: 'custom-tooltip',
        direction: 'top',
        offset: [0, -5]
      });
      
      marker.addTo(lg);
    }
  }, [visibleNodes, currentDay, zoom]);

  return null;
}
