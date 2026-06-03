import { useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useReflowStore } from "@/state/reflowStore";
import { Artboard } from "./Artboard";
import { useTemplateStore } from "@/state/templateStore";
import { parseCustomRange, resolveBysurah, resolveByPara } from "@/lib/exportRangeResolver";
import { SURAH_NAMES_BN } from "@/data/surahNames";

type ExportFormat = "pdf" | "png" | "jpg";
type RangeMode = "full" | "single" | "custom" | "surah" | "para";

export function BatchExportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pages = useReflowStore((s) => s.pages);
  const distribution = useReflowStore((s) => s.distribution);
  const tmpl = useTemplateStore((s) => s.getActiveTemplate());

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pdfInstance, setPdfInstance] = useState<jsPDF | null>(null);
  
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [rangeMode, setRangeMode] = useState<RangeMode>("full");
  const [singlePage, setSinglePage] = useState(1);
  const [customRangeText, setCustomRangeText] = useState("");
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [selectedPara, setSelectedPara] = useState(1);
  const [resolvedPageIndices, setResolvedPageIndices] = useState<number[]>([]);

  // Compute surah and para lists from distribution
  const surahList = useMemo(() => {
    const seen = new Set<number>();
    return distribution
      .filter(d => d.surah > 0 && !seen.has(d.surah) && seen.add(d.surah))
      .map(d => ({ num: d.surah, name: SURAH_NAMES_BN[d.surah] ?? `সূরা ${d.surah}` }));
  }, [distribution]);

  const paraList = useMemo(() => {
    const seen = new Set<number>();
    return distribution
      .filter(d => d.para > 0 && !seen.has(d.para) && seen.add(d.para))
      .map(d => ({ num: d.para, label: `পারা ${d.para}` }));
  }, [distribution]);

  const getPageIndices = (): number[] => {
    switch (rangeMode) {
      case "full":    return pages.map((_, i) => i);
      case "single":  return [singlePage - 1].filter(i => i >= 0 && i < pages.length);
      case "custom":  return parseCustomRange(customRangeText, pages.length).map(n => n - 1);
      case "surah":   return resolveBysurah(selectedSurah, distribution);
      case "para":    return resolveByPara(selectedPara, distribution);
    }
  };

  useEffect(() => {
    if (!open) {
      setIsExporting(false);
      setProgress(0);
      setCurrentPageIndex(0);
      setPdfInstance(null);
    }
  }, [open]);

  const startExport = async () => {
    const indices = getPageIndices();
    if (indices.length === 0) return;
    
    setResolvedPageIndices(indices);
    setIsExporting(true);
    setProgress(0);
    setCurrentPageIndex(0);

    if (format === "pdf") {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      setPdfInstance(pdf);
    }
  };

  useEffect(() => {
    if (!isExporting || currentPageIndex >= resolvedPageIndices.length) return;
    if (format === "pdf" && !pdfInstance) return;

    const processPage = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const el = document.getElementById(`export-artboard-${currentPageIndex}`);
      if (!el) return;

      try {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });

        if (format === "pdf" && pdfInstance) {
          const imgData = canvas.toDataURL("image/png");
          const pdfWidth = pdfInstance.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          if (currentPageIndex > 0) pdfInstance.addPage();
          pdfInstance.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        } else {
          // PNG or JPG
          const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
          const quality = format === "jpg" ? 0.92 : undefined;
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const link = document.createElement("a");
          const pageNo = resolvedPageIndices[currentPageIndex]! + 1;
          link.download = `${tmpl.name}-page-${pageNo}.${format}`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          await new Promise((resolve) => setTimeout(resolve, 800)); // Delay to avoid browser crash
        }

        const nextIndex = currentPageIndex + 1;
        setProgress((nextIndex / resolvedPageIndices.length) * 100);

        if (nextIndex >= resolvedPageIndices.length) {
          if (format === "pdf" && pdfInstance) {
            pdfInstance.save(`${tmpl.name}-export.pdf`);
          }
          setIsExporting(false);
          onOpenChange(false);
        } else {
          setCurrentPageIndex(nextIndex);
        }
      } catch (err) {
        console.error("Export error on page index " + currentPageIndex, err);
        setIsExporting(false);
      }
    };

    processPage();
  }, [isExporting, currentPageIndex, pdfInstance, resolvedPageIndices.length, tmpl.name, format, onOpenChange, resolvedPageIndices]);

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>রপ্তানি</DialogTitle>
        </DialogHeader>

        {!isExporting ? (
          <div className="space-y-6 py-4 font-bangla">
            {/* Format selector */}
            <div>
              <Label className="text-sm font-medium mb-2 block">ফরম্যাট</Label>
              <div className="flex gap-2">
                {(["pdf", "png", "jpg"] as ExportFormat[]).map(f => (
                  <button key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 rounded border py-2 text-sm font-semibold uppercase transition-all ${
                      format === f ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                   : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                    }`}
                  >{f}</button>
                ))}
              </div>
            </div>

            {/* Range selector */}
            <div>
              <Label className="text-sm font-medium mb-2 block">পেজ রেঞ্জ</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {([
                  { mode: "full",   label: "সম্পূর্ণ কোরআন" },
                  { mode: "single", label: "একটি পেজ" },
                  { mode: "custom", label: "কাস্টম রেঞ্জ" },
                  { mode: "surah",  label: "সূরা অনুযায়ী" },
                  { mode: "para",   label: "পারা অনুযায়ী" },
                ] as {mode: RangeMode, label: string}[]).map(({ mode, label }) => (
                  <button key={mode}
                    onClick={() => setRangeMode(mode)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      rangeMode === mode ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                         : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >{label}</button>
                ))}
              </div>

              {/* Range detail inputs */}
              {rangeMode === "single" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-20">পেজ নম্বর</Label>
                  <Input type="number" min={1} max={pages.length} value={singlePage}
                    onChange={(e) => setSinglePage(+e.target.value)}
                    className="w-24" />
                  <span className="text-xs text-slate-400">/ {pages.length}</span>
                </div>
              )}
              {rangeMode === "custom" && (
                <div>
                  <Input placeholder="যেমন: 1, 4, 10-15, 20"
                    value={customRangeText}
                    onChange={(e) => setCustomRangeText(e.target.value)} />
                  <p className="text-xs text-slate-400 mt-1">কমা ও হাইফেন ব্যবহার করুন</p>
                </div>
              )}
              {rangeMode === "surah" && (
                <select value={selectedSurah} onChange={(e) => setSelectedSurah(+e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  {surahList.map(s => (
                    <option key={s.num} value={s.num}>{s.num}. {s.name}</option>
                  ))}
                </select>
              )}
              {rangeMode === "para" && (
                <select value={selectedPara} onChange={(e) => setSelectedPara(+e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  {paraList.map(p => (
                    <option key={p.num} value={p.num}>{p.label}</option>
                  ))}
                </select>
              )}

              {/* Page count preview */}
              <p className="text-xs text-slate-500 mt-2">
                নির্বাচিত পেজ: <strong>{getPageIndices().length}</strong> টি
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
              <Button onClick={startExport}
                disabled={getPageIndices().length === 0}
                className="bg-emerald-600 hover:bg-emerald-700">
                রপ্তানি শুরু করুন ({getPageIndices().length} পেজ)
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-6 font-bangla">
            <Progress value={progress} />
            <p className="text-sm text-center text-slate-500">
              পেজ রেন্ডার হচ্ছে: {currentPageIndex + 1} / {resolvedPageIndices.length}
            </p>
          </div>
        )}

        {/* Hidden render area */}
        {isExporting && resolvedPageIndices[currentPageIndex] !== undefined && pages[resolvedPageIndices[currentPageIndex]!] && (
          <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
            <div id={`export-artboard-${currentPageIndex}`}>
              <Artboard page={pages[resolvedPageIndices[currentPageIndex]!]!} zoom={1} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
