import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type LayoutImpactDialogProps = {
  open: boolean;
  message?: string;
  onKeepScope: () => void;
  onChangeScope: () => void;
  onCancel: () => void;
};

export function LayoutImpactDialog({
  open,
  message,
  onKeepScope,
  onChangeScope,
  onCancel,
}: LayoutImpactDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Layout impact সতর্কতা</AlertDialogTitle>
          <AlertDialogDescription>
            {message ?? "এই পরিবর্তন reserved/blank/surah-open slot-এ প্রভাব ফেলতে পারে। কী করতে চান?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>বাতিল</AlertDialogCancel>
          <AlertDialogAction onClick={onChangeScope} className="bg-neutral-700 text-white hover:bg-neutral-600">
            Scope পরিবর্তন করব
          </AlertDialogAction>
          <AlertDialogAction onClick={onKeepScope}>বর্তমান scope রাখুন</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
