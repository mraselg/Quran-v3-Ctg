import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTemplateStore, BUILT_IN_IDS } from "@/state/templateStore";
import { useOverridesStore } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { useModal } from "@/context/ModalContext";
import type { MasterTemplate, ColorProfile, MeaningConfig } from "@/types/template";
import { DEFAULT_RULE_COLORS } from "@/data/defaultTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Copy, Trash, Upload, LayoutTemplate, Type, Image as ImageIcon, Printer, Settings, BookOpen, Info } from "lucide-react";
import { ALL_RULE_IDS, TAJWEED_RULE_NAMES } from "@/lib/tajweed/svgMap";

const defaultMeaningConfig: MeaningConfig = {
  showPronunciation: false, pronunciationFontPx: 14, pronunciationRatio: 0.0,
  showMeaning: false, meaningFontPx: 12, meaningRatio: 0.0,
};

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

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Column 1: Layout + Surah Header */}
        <div className="space-y-8">
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

        {/* Column 2: Assets + Print Config */}
        <div className="space-y-8">
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

          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Printer className="h-5 w-5 text-emerald-600" />
                প্রিন্ট ও রপ্তানি কনফিগ
              </CardTitle>
              <CardDescription>ব্লিড মার্জিন ও কালার প্রোফাইল</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Bleed Margin */}
              <div>
                <Label>ব্লিড মার্জিন (mm)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    type="range" min={0} max={10} step={0.5}
                    value={activeTemplate.printConfig?.bleedMarginMm ?? 0}
                    onChange={(e) => applyChange(t => {
                      t.printConfig = { ...(t.printConfig ?? { colorProfile: "RGB" }), bleedMarginMm: +e.target.value };
                    })}
                    disabled={isBuiltIn}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {(activeTemplate.printConfig?.bleedMarginMm ?? 0).toFixed(1)} mm
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">প্রিন্ট-রেডি PDF-এ সাধারণত 3mm ব্লিড দেওয়া হয়</p>
              </div>
              {/* Color Profile */}
              <div>
                <Label>কালার প্রোফাইল</Label>
                <div className="flex gap-3 mt-2">
                  {(["RGB", "CMYK"] as const).map((profile) => (
                    <label key={profile} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={profile}
                        checked={(activeTemplate.printConfig?.colorProfile ?? "RGB") === profile}
                        onChange={() => applyChange(t => {
                          t.printConfig = { ...(t.printConfig ?? { bleedMarginMm: 0 }), colorProfile: profile };
                        })}
                        disabled={isBuiltIn}
                      />
                      <span className="text-sm">{profile}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">CMYK: পেশাদার প্রিন্টিং প্রেস, RGB: ডিজিটাল/স্ক্রিন</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Typography + Tajweed + Meaning */}
        <div className="space-y-8">
          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="h-5 w-5 text-emerald-600" />
                গ্লোবাল টাইপোগ্রাফি ডিফল্ট
              </CardTitle>
              <CardDescription>এই টেমপ্লেটের আরবি/বাংলা সাইজ ও পজিশন ডিফল্ট</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Arabic/Bangla font size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>আরবি ফন্ট সাইজ (px)</Label>
                  <Input type="number" min={20} max={100}
                    value={activeTemplate.typography.arabicFontPx}
                    onChange={(e) => applyChange(t => { t.typography.arabicFontPx = +e.target.value; })}
                    disabled={isBuiltIn} />
                </div>
                <div>
                  <Label>বাংলা ফন্ট সাইজ (px)</Label>
                  <Input type="number" min={8} max={40}
                    value={activeTemplate.typography.banglaFontPx}
                    onChange={(e) => applyChange(t => { t.typography.banglaFontPx = +e.target.value; })}
                    disabled={isBuiltIn} />
                </div>
              </div>
              {/* Symbol font size */}
              <div>
                <Label>তাজভীদ প্রতীক সাইজ (px)</Label>
                <Input type="number" min={10} max={60}
                  value={activeTemplate.typography.symbolFontPx}
                  onChange={(e) => applyChange(t => { t.typography.symbolFontPx = +e.target.value; })}
                  disabled={isBuiltIn} />
              </div>
              {/* Y offsets */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { field: "defaultArabicY" as const, label: "আরবি Y অফসেট" },
                  { field: "defaultBanglaY" as const, label: "বাংলা Y অফসেট" },
                  { field: "defaultSymbolY" as const, label: "প্রতীক Y অফসেট" },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <Label className="text-xs">{label}</Label>
                    <Input type="number" min={-50} max={50}
                      value={activeTemplate.typography[field] ?? 0}
                      onChange={(e) => applyChange(t => { t.typography[field] = +e.target.value; })}
                      disabled={isBuiltIn} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-emerald-600" />
                তাজভীদ কাস্টমাইজেশন
              </CardTitle>
              <CardDescription>১২টি তাজভীদ বিধির রঙ ও দৃশ্যমানতা</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Master toggle row */}
              <div className="flex items-center justify-between pb-3 border-b mb-3">
                <span className="text-sm font-medium">সব চালু/বন্ধ</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline"
                    onClick={() => !isBuiltIn && ALL_RULE_IDS.forEach(id =>
                      applyChange(t => { t.tajweedConfig = t.tajweedConfig ?? {}; t.tajweedConfig[id] = { ...(t.tajweedConfig[id] ?? { color: DEFAULT_RULE_COLORS[id]! }), enabled: true }; })
                    )}
                    disabled={isBuiltIn}>সব চালু</Button>
                  <Button size="sm" variant="outline"
                    onClick={() => !isBuiltIn && ALL_RULE_IDS.forEach(id =>
                      applyChange(t => { t.tajweedConfig = t.tajweedConfig ?? {}; t.tajweedConfig[id] = { ...(t.tajweedConfig[id] ?? { color: DEFAULT_RULE_COLORS[id]! }), enabled: false }; })
                    )}
                    disabled={isBuiltIn}>সব বন্ধ</Button>
                </div>
              </div>

              {/* 12 rule rows */}
              <div className="space-y-2">
                {ALL_RULE_IDS.map((id) => {
                  const ruleCfg = activeTemplate.tajweedConfig?.[id];
                  const isOn = ruleCfg?.enabled ?? (id === 1 || id === 9);
                  const color = ruleCfg?.color ?? DEFAULT_RULE_COLORS[id]!;
                  return (
                    <div key={id} className="flex items-center gap-3">
                      {/* Enable toggle */}
                      <Switch
                        checked={isOn}
                        onCheckedChange={(on) => applyChange(t => {
                          t.tajweedConfig = t.tajweedConfig ?? {};
                          t.tajweedConfig[id] = { ...(t.tajweedConfig[id] ?? { color }), enabled: on };
                        })}
                        disabled={isBuiltIn}
                      />
                      {/* Rule name */}
                      <span className="flex-1 text-xs" style={{ color: isOn ? color : "#6b7280" }}>
                        {id}. {TAJWEED_RULE_NAMES[id]}
                      </span>
                      {/* Color picker */}
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => applyChange(t => {
                          t.tajweedConfig = t.tajweedConfig ?? {};
                          t.tajweedConfig[id] = { ...(t.tajweedConfig[id] ?? { enabled: isOn }), color: e.target.value };
                        })}
                        disabled={isBuiltIn || !isOn}
                        className="h-7 w-8 rounded cursor-pointer border border-slate-300 disabled:opacity-40 disabled:cursor-default p-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                অর্থ ও উচ্চারণ
              </CardTitle>
              <CardDescription>আরবির নিচে বাংলা অনুবাদ ও উচ্চারণ লেয়ার</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Pronunciation toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>বাংলা উচ্চারণ দেখাও</Label>
                  <p className="text-xs text-slate-400">verses.json "bn" ফিল্ড থেকে</p>
                </div>
                <Switch
                  checked={activeTemplate.meaningConfig?.showPronunciation ?? false}
                  onCheckedChange={(on) => applyChange(t => {
                    t.meaningConfig = { ...(t.meaningConfig ?? defaultMeaningConfig), showPronunciation: on, pronunciationRatio: on ? 0.18 : 0.0 };
                  })}
                  disabled={isBuiltIn}
                />
              </div>
              {(activeTemplate.meaningConfig?.showPronunciation) && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-slate-200">
                  <div>
                    <Label className="text-xs">ফন্ট সাইজ (px)</Label>
                    <Input type="number" min={8} max={24}
                      value={activeTemplate.meaningConfig?.pronunciationFontPx ?? 14}
                      onChange={(e) => applyChange(t => { t.meaningConfig!.pronunciationFontPx = +e.target.value; })}
                      disabled={isBuiltIn} />
                  </div>
                  <div>
                    <Label className="text-xs">ব্যান্ড অনুপাত (0–0.25)</Label>
                    <Input type="number" min={0.05} max={0.25} step={0.01}
                      value={activeTemplate.meaningConfig?.pronunciationRatio ?? 0.18}
                      onChange={(e) => applyChange(t => { t.meaningConfig!.pronunciationRatio = +e.target.value; })}
                      disabled={isBuiltIn} />
                  </div>
                </div>
              )}

              {/* Meaning toggle */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label>বাংলা অর্থ দেখাও</Label>
                  <p className="text-xs text-slate-400">verses.json "t_bn" ফিল্ড থেকে</p>
                </div>
                <Switch
                  checked={activeTemplate.meaningConfig?.showMeaning ?? false}
                  onCheckedChange={(on) => applyChange(t => {
                    t.meaningConfig = { ...(t.meaningConfig ?? defaultMeaningConfig), showMeaning: on, meaningRatio: on ? 0.15 : 0.0 };
                  })}
                  disabled={isBuiltIn}
                />
              </div>
              {(activeTemplate.meaningConfig?.showMeaning) && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-slate-200">
                  <div>
                    <Label className="text-xs">ফন্ট সাইজ (px)</Label>
                    <Input type="number" min={8} max={20}
                      value={activeTemplate.meaningConfig?.meaningFontPx ?? 12}
                      onChange={(e) => applyChange(t => { t.meaningConfig!.meaningFontPx = +e.target.value; })}
                      disabled={isBuiltIn} />
                  </div>
                  <div>
                    <Label className="text-xs">ব্যান্ড অনুপাত (0–0.2)</Label>
                    <Input type="number" min={0.05} max={0.2} step={0.01}
                      value={activeTemplate.meaningConfig?.meaningRatio ?? 0.15}
                      onChange={(e) => applyChange(t => { t.meaningConfig!.meaningRatio = +e.target.value; })}
                      disabled={isBuiltIn} />
                  </div>
                </div>
              )}

              {/* Warning banner when both are enabled */}
              {(activeTemplate.meaningConfig?.showPronunciation && activeTemplate.meaningConfig?.showMeaning) && (
                <div className="rounded bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                  উচ্চারণ + অর্থ একসাথে চালু থাকলে পৃষ্ঠায় লাইন সংখ্যা স্বয়ংক্রিয়ভাবে কমতে পারে।
                  Band ratios যোগফল 1.0 ছাড়িয়ে গেলে Arabic অংশ সংকুচিত হবে।
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
