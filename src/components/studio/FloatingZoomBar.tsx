import { useState, useRef } from "react";
import { Lock, Unlock, Minus, Plus, Maximize2, PanelLeft, ZoomIn, GripVertical } from "lucide-react";

type Props = {
  zoom: number;
  setZoom: (z: number) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function FloatingZoomBar({ zoom, setZoom, onFitPage, onFitWidth, containerRef }: Props) {
  const [isLocked, setIsLocked] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);

  const clamp = (z: number) => Math.max(25, Math.min(300, Math.round(z)));
  const [zoomEditing, setZoomEditing] = useState(false);
  const [zoomInput, setZoomInput] = useState("");
  const zoomInputRef = useRef<HTMLInputElement>(null);

  const startZoomEdit = () => {
    setZoomInput(String(zoom));
    setZoomEditing(true);
    setTimeout(() => zoomInputRef.current?.select(), 10);
  };
  
  const commitZoomEdit = () => {
    const v = parseInt(zoomInput, 10);
    if (!isNaN(v)) setZoom(clamp(v));
    setZoomEditing(false);
  };

  const handleUnlock = () => {
    setIsLocked(false);
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      // Default width of floating bar is roughly 340px, position it horizontally centered, slightly below top
      setPos({ x: Math.max(0, (cw - 340) / 2), y: 32 });
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isLocked) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...pos } };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.startPos.x + dx, y: Math.max(0, dragRef.current.startPos.y + dy) });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const renderZoomControls = () => (
    <>
      <ToolBtn onClick={() => setZoom(clamp(zoom - 10))} title="Zoom out ([)"><Minus className="h-3.5 w-3.5" /></ToolBtn>

      {zoomEditing ? (
        <input
          ref={zoomInputRef}
          type="number"
          min={25}
          max={300}
          value={zoomInput}
          onChange={(e) => setZoomInput(e.target.value)}
          onBlur={commitZoomEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitZoomEdit();
            if (e.key === "Escape") setZoomEditing(false);
          }}
          className="w-[52px] rounded-md border border-amber-500/60 bg-neutral-800 px-1 py-1 text-center text-xs font-bold tabular-nums text-amber-200 outline-none focus:border-amber-400"
        />
      ) : (
        <button
          onClick={startZoomEdit}
          title="ক্লিক করে পার্সেন্টেজ লিখুন"
          className="min-w-[52px] rounded-md border border-transparent bg-transparent px-2 py-1 text-center text-xs font-bold tabular-nums text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800 transition-colors"
        >
          {zoom}%
        </button>
      )}

      <ToolBtn onClick={() => setZoom(clamp(zoom + 10))} title="Zoom in (])"><Plus className="h-3.5 w-3.5" /></ToolBtn>
      <div className="mx-1 h-4 w-px bg-neutral-800" />
      <button onClick={onFitPage} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100" title="ফিট টু পেজ (F)">
        <Maximize2 className="h-3.5 w-3.5" />পেজ
      </button>
      <button onClick={onFitWidth} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100" title="ফিট টু ক্যানভাস">
        <PanelLeft className="h-3.5 w-3.5" />ক্যানভাস
      </button>
      <button onClick={() => setZoom(100)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100" title="100%">
        <ZoomIn className="h-3.5 w-3.5" />1:1
      </button>
    </>
  );

  if (isLocked) {
    return (
      <div className="flex w-full items-center border-b border-neutral-800 bg-[#161616] px-4 py-1.5 shadow-sm z-30 relative">
        <div className="flex-none">
          <button 
            onClick={handleUnlock} 
            title="আনলক করে ফ্লোটিং করুন" 
            className="flex items-center justify-center text-neutral-500 hover:text-amber-400 p-1.5 rounded-md hover:bg-neutral-800 transition-colors"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex justify-center items-center gap-1">
          {renderZoomControls()}
        </div>
        {/* Empty div on the right to balance the flex layout so controls are exactly centered */}
        <div className="flex-none w-8"></div>
      </div>
    );
  }

  // Floating Unlocked State
  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        zIndex: 40,
      }}
      className={`flex items-center gap-1 rounded-full border border-neutral-700/80 bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur-md transition-[box-shadow,transform] duration-200 ${isDragging ? "scale-105 shadow-2xl" : ""}`}
    >
      <div className="flex items-center gap-0.5 ml-1">
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          title="ড্রাগ করুন"
          className="text-neutral-500 cursor-grab active:cursor-grabbing hover:text-amber-400 p-1 rounded-md"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={() => setIsLocked(true)} title="লক করুন" className="text-amber-500 hover:text-amber-400 p-1 rounded-md hover:bg-neutral-800 transition-colors">
          <Unlock className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-1 h-4 w-px bg-neutral-800" />

      <div className="flex items-center gap-1 pr-2">
        {renderZoomControls()}
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, title, disabled }: { children: React.ReactNode; onClick?: () => void; title?: string; disabled?: boolean; }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30">
      {children}
    </button>
  );
}
