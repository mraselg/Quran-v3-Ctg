# Paragraph Flow & Area Text Linking Implementation Plan

This plan details the implementation of linked paragraph flow for "Area Text" mode in Quran Studio Pro. This will allow Area Text frames to cascade overflow and pull text from adjacent rows, acting as continuously linked text boxes (similar to InDesign).

## Step 1: Implement 2D Area Split Logic (`src/lib/canvasMeasure.ts`)
We will create a new function `splitToFitArea` that measures text wrapping based on a **fixed height** constraint.
- **Inputs:** `text`, `availableWidth`, `maxHeight`, `fontFamily`, `fontSize`, `leading`, `layer`.
- **Logic:** 
  1. Tokenize the text into words.
  2. Greedily word-wrap the text line-by-line.
  3. Calculate the cumulative pixel height (`lineCount * (fontSize * leading) + padding`).
  4. Once adding a wrapped line exceeds `maxHeight`, all remaining words are pushed into the `overflow` string.
  5. Return `{ fits, overflow }`.

## Step 2: Remove Reflow Blocks (`src/lib/textReflow.ts`)
Currently, Area Text explicitly aborts the cascade. We will:
- Remove the early return `if (textMode === "area") return` in `reflowLayerText`.
- Remove the `isAreaLayer` bypass check inside `reflowFrom`, `reflowFromAsync`, and `backFillFrom`.

## Step 3: Update Forward Cascade (`reflowFrom` & `planCascade`)
Modify the reflow loop to respect Area Text dimensions:
- For each row, check if `textMode === "area"` and `areaHeight` is set.
- **If Point Text (or Area with Auto-height):** Use the existing `splitToFitForLayer` (1D width constraint).
- **If Area Text (with fixed `areaHeight`):** Use the new `splitToFitArea` (2D height constraint).
- The `overflow` string will then successfully carry over to the next row in the loop.

## Step 4: Update Backward Flow / Pull-up (`backFillFrom`)
When text is deleted, space is freed up. We must pull text from the next row to fill it.
- **For Point Text:** Pull if `currentWidth < availableWidth - 20`.
- **For Area Text:** Measure current text height using `calculateAreaTextHeight`. If `currentHeight < areaHeight`, pull words from the next row one-by-one. Re-measure after each word. Stop pulling when `newHeight > areaHeight`.

## Step 5: Handle Auto-height edge cases
If an Area Text frame has `areaHeight: null` (Auto), it will theoretically grow infinitely downward and overlap other rows. 
- **Strategy:** If a user links layers, they *must* set a specific frame height (using the Wand Auto-fit tool or typing a value). If `areaHeight` is null, the system will fall back to treating it as a 1-line Point text for cascade purposes, preventing layout destruction.

---
### 🇧🇩 বাংলা সারাংশ (Bengali Summary)

**উদ্দেশ্য:** Area Text (টেক্সট এরিয়া) মোডে থাকা সারিগুলোকে একে অপরের সাথে লিঙ্ক করা, যাতে একটি সারি থেকে টেক্সট উপচে পড়লে (overflow) তা স্বয়ংক্রিয়ভাবে পরের সারিতে চলে যায় এবং ডিলিট করলে পরের সারি থেকে টেক্সট আগের সারিতে উঠে আসে।

**ধাপসমূহ:**
১. **`splitToFitArea` তৈরি:** শুধু পিক্সেল প্রস্থ (width) নয়, বরং উচ্চতার (height) উপর ভিত্তি করে টেক্সটকে ভাগ করার লজিক তৈরি করা হবে। ফ্রেমের উচ্চতা পূর্ণ হয়ে গেলে বাকি শব্দগুলো `overflow` হিসেবে আলাদা করা হবে।
২. **Reflow বাইপাস সরানো:** বর্তমানে Area Text-এ অটো-রিফ্লো ব্লক করা আছে, সেই ব্লকগুলো (early return) রিমুভ করা হবে।
৩. **ক্যাসকেড (Cascade) আপডেট:** নতুন শব্দ যোগ করলে তা বর্তমান ফ্রেমের উচ্চতা (`areaHeight`) চেক করবে। জায়গা না থাকলে অতিরিক্ত শব্দ পরের লাইনে ঠেলে দেবে।
৪. **ব্যাকফিল (Back-fill) আপডেট:** শব্দ ডিলিট করলে বর্তমান ফ্রেমের উচ্চতা চেক করে দেখবে জায়গা খালি হয়েছে কিলগ্ন। জায়গা থাকলে পরের লাইন থেকে শব্দ টেনে আনবে।
৫. **Auto-height হ্যান্ডলিং:** Area Text-এ যদি উচ্চতা নির্দিষ্ট করা না থাকে (Auto), তবে তা আগের মতো Point Text-এর মতোই কাজ করবে, যাতে পেইজের লেআউট ভেঙে না যায়। ফ্রেম হাইট নির্দিষ্ট (Fixed px) থাকলেই কেবল মাল্টি-লাইন ক্যাসকেড কাজ করবে।
