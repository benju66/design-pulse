"use client";

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
const FloorplanCanvas = dynamic(() => import('@/components/FloorplanCanvas'), { ssr: false });
import { useMapStore } from '@/stores/useMapStore';
import { Zone } from '@/types/map.types';

export default function MapSandbox() {
  const setToolMode = useMapStore(s => s.setToolMode);

  useEffect(() => {
    setToolMode('select');
  }, [setToolMode]);

  const dummyZones: Zone[] = [
    {
      id: 'zone-1',
      label: 'Conference Room',
      color: '#3b82f6',
      opacity: 0.5,
      coordinates: [
        { pctX: 0.2, pctY: 0.2 },
        { pctX: 0.4, pctY: 0.2 },
        { pctX: 0.4, pctY: 0.4 },
        { pctX: 0.2, pctY: 0.4 }
      ]
    },
    {
      id: 'zone-2',
      label: 'Break Room',
      color: '#10b981',
      opacity: 0.5,
      coordinates: [
        { pctX: 0.5, pctY: 0.5 },
        { pctX: 0.7, pctY: 0.5 },
        { pctX: 0.7, pctY: 0.7 },
        { pctX: 0.5, pctY: 0.7 }
      ]
    }
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 p-8">
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 p-4 mr-4 rounded-xl flex flex-col gap-4">
        <h2 className="font-bold text-lg">Controls</h2>
        <button onClick={() => setToolMode('pan')} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded">Pan Tool</button>
        <button onClick={() => setToolMode('select')} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded">Select Tool</button>
        <button onClick={() => setToolMode('draw')} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded">Draw Tool</button>
      </div>
      
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 relative">
        <FloorplanCanvas 
          projectId="sandbox-test"
          sheetId=""
          maxZoom={0}
          originalWidth={1000}
          originalHeight={1000}
          zones={dummyZones}
          onUpdateZonePolygon={(id, points) => console.log('Update Zone', id, points)}
          onPolygonComplete={(points) => console.log('Polygon Complete', points)}
        />
      </div>
    </div>
  );
}
