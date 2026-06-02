import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTemplateStore, BUILT_IN_IDS } from "@/state/templateStore";
import { useOverridesStore } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { useModal } from "@/context/ModalContext";
import type { MasterTemplate, ColorProfile } from "@/types/template";
import { KARIANA_TEMPLATE } from "@/data/defaultTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Trash, Upload, LayoutTemplate, Type, Image as ImageIcon, Printer, Settings, Layers, Info } from "lucide-react";

export function TemplateBuilder() {
  const navigate = useNavigate();
  const templates = useTemplateStore((s) => s.templates);
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId);
  const setActiveTemplate = useTemplateStore((s) => s.setActiveTemplate);
  const upsertTemplate = useTemplateStore((s) => s.upsertTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const duplicateActiveTemplate = useTemplateStore((s) => s.duplicateActiveTemplate);
  const activeTemplate = useTemplateStore((s) => s.getActiveTemplate());

  const rebuild = useReflowStore((s) => s.rebuild);
  const { showPrompt, showConfirm } = useModal();
  
  const isBuiltIn = BUILT_IN_IDS.has(activeTemplate.id);

  const handleBack = () => {
    navigate({ to: "/" });
  };

  const applyChange = (updater: (draft: MasterTemplate) => void) => {
    if (isBuiltIn) return;
    const next = structuredClone(activeTemplate);
    updater(next);
    upsertTemplate(next);
    rebuild();
  };

  const handleLinesPerPageChange = (newCount: number) => {
    if (newCount < 7 || newCount > 15 || isBuiltIn) return;
    
    applyChange((t) => {
      const { headerBand, footerBandY1 } = t.pageGeometry;
      const usableStart = headerBand[1] + 5;
      const usableEnd = footerBandY1 - 5;
      const usableHeight = usableEnd - usableStart;
      const gapBetweenBands = usableHeight * 0.015;
      const totalGaps = (newCount - 1) * gapBetweenBands;
      const bandHeight = (usableHeight - totalGaps) / newCount;

      const newRowBands: Array<[number, number]> = Array.from(
        { length: newCount },
        (_, i) => {
          const y0 = usableStart + i * (bandHeight + gapBetweenBands);
          const y1 = y0 + bandHeight;
          return [y0, y1];
        }
      );

      t.linesPerPage = newCount;
      t.pageGeometry.rowBandsSvg = newRowBands;
    });
  };

  const handleSvgUpload = async (file: File, field: "pageTemplateSvg" | "surahOpenSvg") => {
    if (isBuiltIn) return;
    const text = await file.text();
    const base64 = btoa(text);
    const objectUrl = URL.createObjectURL(file);
    applyChange((t) => {
      t.assets[field] = objectUrl;
      t.assets[`${field}Data`] = base64;
    });
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 text-slate-900 font-bangla">
      <header className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">টেমপ্লেট বিল্ডার</h1>
            <p className="text-sm text-slate-500">কাস্টম কোরআন ডিজাইন এবং লেআউট সেট করুন</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={activeTemplateId}
            onChange={(e) => {
              useOverridesStore.getState().resetAll();
              setActiveTemplate(e.target.value);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 min-w-[200px]"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {BUILT_IN_IDS.has(t.id) && "(Built-in)"}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={async () => {
              const name = await showPrompt({
                title: "নতুন টেমপ্লেটের নাম দিন",
                defaultValue: `${activeTemplate.name} (Copy)`
              });
              if (name) {
                const copy = duplicateActiveTemplate(name);
                setActiveTemplate(copy.id);
              }
            }}
          >
            <Copy className="h-4 w-4 mr-2" /> কপি তৈরি
          </Button>
          <Button
            variant="destructive"
            disabled={isBuiltIn}
            onClick={async () => {
              const confirmed = await showConfirm({
                title: "টেমপ্লেট মুছুন",
                description: "আপনি কি নিশ্চিত যে আপনি এই টেমপ্লেটটি মুছে ফেলতে চান?",
                confirmLabel: "হ্যাঁ, মুছুন"
              });
              if (confirmed) {
                deleteTemplate(activeTemplate.id);
                rebuild();
              }
            }}
          >
            <Trash className="h-4 w-4 mr-2" /> মুছুন
          </Button>
          <Button
            onClick={() => navigate({ to: "/editor" })}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            এডিটর খুলুন
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1400px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
        {/* Column 1 */}
        <div className="space-y-8">
          {/* Basic Info */}
          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-emerald-600" />
                বেসিক তথ্য
              </CardTitle>
              <CardDescription>টেমপ্লেটের নাম ও বিবরণ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                <Label>টেমপ্লেটের নাম</Label>
                <Input
                  value={activeTemplate.name}
                  onChange={(e) => applyChange(t => { t.name = e.target.value; })}
                  disabled={isBuiltIn}
                />
              </div>
              <div className="grid gap-2">
                <Label>বিবরণ</Label>
                <Input
                  value={activeTemplate.description ?? ""}
                  onChange={(e) => applyChange(t => { t.description = e.target.value; })}
                  disabled={isBuiltIn}
                />
              </div>
            </CardContent>
          </Card>

          {/* Layout Section */}
          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayoutTemplate className="h-5 w-5 text-emerald-600" />
                পৃষ্ঠা বিন্যাস (Layout)
              </CardTitle>
              <CardDescription>পৃষ্ঠার লাইন সংখ্যা এবং মার্জিন পরিবর্তন করুন</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                <Label>প্রতি পৃষ্ঠায় লাইন (৭-১৫)</Label>
                <Input
                  type="number"
                  value={activeTemplate.linesPerPage}
                  onChange={(e) => handleLinesPerPageChange(parseInt(e.target.value, 10))}
                  disabled={isBuiltIn}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>আর্টবোর্ড প্রস্থ (px)</Label>
                  <Input
                    type="number"
                    value={activeTemplate.pageGeometry.displayW}
                    onChange={(e) => applyChange(t => { t.pageGeometry.displayW = parseFloat(e.target.value); })}
                    disabled={isBuiltIn}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>পার্শ্ব প্যাডিং (px)</Label>
                  <Input
                    type="number"
                    value={activeTemplate.pageGeometry.sidePadPx}
                    onChange={(e) => applyChange(t => { t.pageGeometry.sidePadPx = parseFloat(e.target.value); })}
                    disabled={isBuiltIn}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typography Settings */}
          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-emerald-600" />
                টাইপোগ্রাফি ডিফল্ট
              </CardTitle>
              <CardDescription>ফন্টের আকার এবং ওয়াই (Y) অফসেট</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>আরবি Y-অফসেট</Label>
                  <Input
                    type="number"
                    value={activeTemplate.typography.defaultArabicY ?? 0}
                    onChange={(e) => applyChange(t => { t.typography.defaultArabicY = parseFloat(e.target.value); })}
                    disabled={isBuiltIn}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>বাংলা Y-অফসেট</Label>
                  <Input
                    type="number"
                    value={activeTemplate.typography.defaultBanglaY ?? 0}
                    onChange={(e) => applyChange(t => { t.typography.defaultBanglaY = parseFloat(e.target.value); })}
                    disabled={isBuiltIn}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>সিম্বল Y-অফসেট</Label>
                  <Input
                    type="number"
                    value={activeTemplate.typography.defaultSymbolY ?? 0}
                    onChange={(e) => applyChange(t => { t.typography.defaultSymbolY = parseFloat(e.target.value); })}
                    disabled={isBuiltIn}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 2 */}
        <div className="space-y-8">
          {/* Sub Layers Section */}
          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-emerald-600" />
                সাব-লেয়ার সেটিং
              </CardTitle>
              <CardDescription>উচ্চারণ এবং অর্থের অনুপাত (0-0.2)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>উচ্চারণ অনুপাত (Ratio)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="0.5"
                    value={activeTemplate.meaningConfig?.pronunciationRatio ?? 0}
                    onChange={(e) => applyChange(t => { 
                      if (!t.meaningConfig) return;
                      t.meaningConfig.pronunciationRatio = parseFloat(e.target.value);
                      t.bandRatios.pronunciationRatio = parseFloat(e.target.value);
                    })}
                    disabled={isBuiltIn}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>উচ্চারণ ফন্ট সাইজ</Label>
                  <Input
                    type="number"
                    value={activeTemplate.meaningConfig?.pronunciationFontPx ?? 14}
                    onChange={(e) => applyChange(t => { 
                      if (!t.meaningConfig) return;
                      t.meaningConfig.pronunciationFontPx = parseFloat(e.target.value); 
                    })}
                    disabled={isBuiltIn}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>অর্থ অনুপাত (Ratio)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="0.5"
                    value={activeTemplate.meaningConfig?.meaningRatio ?? 0}
                    onChange={(e) => applyChange(t => { 
                      if (!t.meaningConfig) return;
                      t.meaningConfig.meaningRatio = parseFloat(e.target.value);
                      t.bandRatios.meaningRatio = parseFloat(e.target.value);
                    })}
                    disabled={isBuiltIn}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>অর্থ ফন্ট সাইজ</Label>
                  <Input
                    type="number"
                    value={activeTemplate.meaningConfig?.meaningFontPx ?? 12}
                    onChange={(e) => applyChange(t => { 
                      if (!t.meaningConfig) return;
                      t.meaningConfig.meaningFontPx = parseFloat(e.target.value); 
                    })}
                    disabled={isBuiltIn}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeTemplate.meaningConfig?.showPronunciation ?? false}
                    onChange={(e) => applyChange(t => {
                      if (!t.meaningConfig) return;
                      t.meaningConfig.showPronunciation = e.target.checked;
                    })}
                    disabled={isBuiltIn}
                  />
                  <span>উচ্চারণ দেখান</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeTemplate.meaningConfig?.showMeaning ?? false}
                    onChange={(e) => applyChange(t => {
                      if (!t.meaningConfig) return;
                      t.meaningConfig.showMeaning = e.target.checked;
                    })}
                    disabled={isBuiltIn}
                  />
                  <span>অর্থ দেখান</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Surah Header Section */}
          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="h-5 w-5 text-emerald-600" />
                সূরা হেডার নিয়ম
              </CardTitle>
              <CardDescription>বিসমিল্লাহ এবং হেডারের স্থান নির্ধারণ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                <Label>হেডার স্প্যান (১-৪ লাইন)</Label>
                <Input
                  type="number"
                  value={activeTemplate.surahOpen.headerSpan}
                  onChange={(e) => applyChange(t => { 
                    const span = parseInt(e.target.value, 10);
                    t.surahOpen.headerSpan = span;
                    t.surahOpen.startAt = span + 1;
                  })}
                  disabled={isBuiltIn}
                />
              </div>
              <div className="grid gap-2">
                <Label>বিসমিল্লাহ আরবি</Label>
                <Input
                  className="font-arabic text-lg text-right"
                  dir="rtl"
                  value={activeTemplate.surahOpen.bismillahArabic}
                  onChange={(e) => applyChange(t => { t.surahOpen.bismillahArabic = e.target.value; })}
                  disabled={isBuiltIn}
                />
              </div>
              <div className="grid gap-2">
                <Label>বিসমিল্লাহ বাংলা</Label>
                <Input
                  value={activeTemplate.surahOpen.bismillahBangla}
                  onChange={(e) => applyChange(t => { t.surahOpen.bismillahBangla = e.target.value; })}
                  disabled={isBuiltIn}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3 */}
        <div className="space-y-8">
           {/* Print Section */}
           <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Printer className="h-5 w-5 text-emerald-600" />
                প্রিন্ট ও এক্সপোর্ট
              </CardTitle>
              <CardDescription>প্রিন্ট ব্লিড এবং কালার প্রোফাইল</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                <Label>ব্লিড মার্জিন (mm)</Label>
                <Input
                  type="number"
                  value={activeTemplate.printConfig?.bleedMarginMm ?? 0}
                  onChange={(e) => applyChange(t => { 
                    if (!t.printConfig) t.printConfig = { bleedMarginMm: 0, colorProfile: "RGB" };
                    t.printConfig.bleedMarginMm = parseFloat(e.target.value); 
                  })}
                  disabled={isBuiltIn}
                />
              </div>
              <div className="grid gap-2">
                <Label>কালার প্রোফাইল</Label>
                <select
                  value={activeTemplate.printConfig?.colorProfile ?? "RGB"}
                  onChange={(e) => applyChange(t => {
                    if (!t.printConfig) t.printConfig = { bleedMarginMm: 0, colorProfile: "RGB" };
                    t.printConfig.colorProfile = e.target.value as ColorProfile;
                  })}
                  disabled={isBuiltIn}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 w-full"
                >
                  <option value="RGB">RGB (ডিজিটাল)</option>
                  <option value="CMYK">CMYK (প্রিন্ট)</option>
                </select>
              </div>
            </CardContent>
          </Card>

           {/* Assets Section */}
           <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-emerald-600" />
                ফ্রেম ও অ্যাসেট (SVG)
              </CardTitle>
              <CardDescription>পৃষ্ঠার বর্ডার এবং সাজসজ্জা আপলোড করুন</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-3">
                <Label>পেজ টেমপ্লেট বর্ডার (SVG)</Label>
                <div className="flex items-center gap-4">
                  <div className="h-24 w-16 border rounded bg-slate-100 flex items-center justify-center overflow-hidden">
                    {activeTemplate.assets.pageTemplateSvg ? (
                      <img src={activeTemplate.assets.pageTemplateSvg} className="w-full h-full object-contain opacity-50" />
                    ) : (
                      <ImageIcon className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 ${isBuiltIn ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload className="h-4 w-4 mr-2" />
                      আপলোড
                      <input type="file" accept=".svg" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) handleSvgUpload(e.target.files[0], "pageTemplateSvg");
                      }} />
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <Label>সূরা হেডার ফ্রেম (SVG)</Label>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-full max-w-[200px] border rounded bg-slate-100 flex items-center justify-center overflow-hidden">
                    {activeTemplate.assets.surahOpenSvg ? (
                      <img src={activeTemplate.assets.surahOpenSvg} className="w-full h-full object-contain opacity-50" />
                    ) : (
                      <ImageIcon className="text-slate-300" />
                    )}
                  </div>
                  <div>
                    <Label className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 ${isBuiltIn ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload className="h-4 w-4 mr-2" />
                      আপলোড
                      <input type="file" accept=".svg" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) handleSvgUpload(e.target.files[0], "surahOpenSvg");
                      }} />
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
