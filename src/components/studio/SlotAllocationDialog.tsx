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

export type SlotAllocationDialogProps = {
  open: boolean;
  overflowText?: string;
  extraRowsNeeded?: number;
  onAddPages: () => void;
  onClip: () => void;
  onCancel: () => void;
};

export function SlotAllocationDialog({
  open,
  overflowText,
  extraRowsNeeded = 0,
  onAddPages,
  onClip,
  onCancel,
}: SlotAllocationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>নতুন slot/page দরকার</AlertDialogTitle>
          <AlertDialogDescription>
            এই পরিবর্তনের জন্য নির্বাচিত scope-এর বাইরে আনুমানিক {extraRowsNeeded} টি অতিরিক্ত row দরকার।
            {overflowText ? <span className="mt-2 block text-neutral-500">Overflow: {overflowText.slice(0, 120)}</span> : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>বাতিল</AlertDialogCancel>
          <AlertDialogAction onClick={onClip} className="bg-amber-600 text-white hover:bg-amber-700">
            Overflow clip করুন
          </AlertDialogAction>
          <AlertDialogAction onClick={onAddPages}>সম্পূর্ণ কুরআন রি-প্যাগিনেট করুন</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
