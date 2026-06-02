import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useReflowStore } from "@/state/reflowStore";
import { Artboard } from "./Artboard";
import { useTemplateStore } from "@/state/templateStore";

type ExportFormat = "pdf" | "png" | "jpeg";

export function BatchExportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pages = useReflowStore((s) => s.pages);
  const tmpl = useTemplateStore((s) => s.getActiveTemplate());
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pdfInstance, setPdfInstance] = useState<jsPDF | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportScale, setExportScale] = useState(2);

  useEffect(() => {
    if (!open) {
      setIsExporting(false);
      setProgress(0);
      setCurrentPageIndex(0);
      setPdfInstance(null);
    }
  }, [open]);

  const startExport = async () => {
    if (pages.length === 0) return;
    setIsExporting(true);
    setProgress(0);
    setCurrentPageIndex(0);

    if (exportFormat === "pdf") {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      setPdfInstance(pdf);
    }
  };

  useEffect(() => {
    if (!isExporting || currentPageIndex >= pages.length) return;
    if (exportFormat === "pdf" && !pdfInstance) return;

    const processPage = async () => {
      // Allow a small delay for React to render the hidden Artboard
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const el = document.getElementById(`export-artboard-${currentPageIndex}`);
      if (!el) {
        console.error("Artboard element not found for export");
        return;
      }

      try {
        const canvas = await html2canvas(el, { scale: exportScale, useCORS: true, logging: false });
        
        if (exportFormat === "pdf" && pdfInstance) {
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pdfWidth = pdfInstance.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

          if (currentPageIndex > 0) {
            pdfInstance.addPage();
          }
          pdfInstance.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        } else {
          // Download individually as PNG/JPEG
          const mime = exportFormat === "png" ? "image/png" : "image/jpeg";
          const ext = exportFormat;
          const imgData = canvas.toDataURL(mime, 0.95);
          
          const a = document.createElement("a");
          a.href = imgData;
          a.download = `${tmpl.name}-Page-${currentPageIndex + 1}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Add extra delay to prevent browser crash from too many downloads
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        const nextIndex = currentPageIndex + 1;
        setProgress((nextIndex / pages.length) * 100);
        
        if (nextIndex >= pages.length) {
          if (exportFormat === "pdf" && pdfInstance) {
            pdfInstance.save(`${tmpl.name}-export.pdf`);
          }
          setIsExporting(false);
          onOpenChange(false);
        } else {
          setCurrentPageIndex(nextIndex);
        }
      } catch (err) {
        console.error("Export error on page " + currentPageIndex, err);
        setIsExporting(false);
      }
    };

    processPage();
  }, [isExporting, currentPageIndex, pdfInstance, pages.length, tmpl.name, exportFormat, exportScale, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>কুরআন রপ্তানি (Batch Export)</DialogTitle>
          <DialogDescription>
            সম্পূর্ণ কুরআন ({pages.length} পেজ) রূপান্তর করা হবে। ফরম্যাট এবং কোয়ালিটি নির্বাচন করুন।
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {!isExporting && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">রপ্তানি ফরম্যাট</label>
                <select 
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  <option value="pdf">১টি অখণ্ড PDF</option>
                  <option value="png">আলাদা PNG ফাইলসমূহ</option>
                  <option value="jpeg">আলাদা JPEG ফাইলসমূহ</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">কোয়ালিটি স্কেল</label>
                <select 
                  value={exportScale}
                  onChange={(e) => setExportScale(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  <option value={1}>1x (সাধারণ)</option>
                  <option value={2}>2x (উচ্চ মান)</option>
                  <option value={3}>3x (প্রিন্ট রেডি - 300dpi)</option>
                </select>
              </div>
            </div>
          )}

          {isExporting ? (
            <div className="space-y-4">
              <Progress value={progress} />
              <p className="text-sm text-center text-slate-500">
                পেজ রেন্ডার হচ্ছে: {currentPageIndex + 1} / {pages.length}
              </p>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
              <Button onClick={startExport} className="bg-emerald-600 hover:bg-emerald-700">রপ্তানি শুরু করুন</Button>
            </div>
          )}
        </div>

        {/* Hidden area to render the current page for html2canvas */}
        {isExporting && pages[currentPageIndex] && (
          <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
            <div id={`export-artboard-${currentPageIndex}`}>
              <Artboard page={pages[currentPageIndex]} zoom={1} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
