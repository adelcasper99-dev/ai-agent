import { prisma } from "@/lib/prisma";


const DEFAULT_FALLBACK_PROMPT = "نظام كاسبر مبيعات ومشتريات كرتونة كرتون مسمار مسامير عسل صاج عميل فاتورة حساب بنزين صيانة مصاريف جنيه أجهزة بضاعة مورد قطع غيار";

/**
 * Dynamically builds a concise domain vocabulary prompt (< 200 tokens) for Whisper STT based on tenant products,
 * knowledge items, and business type.
 * 
 * Falls back to DEFAULT_FALLBACK_PROMPT if no tenantId is provided or tenant has no items.
 */
export async function buildWhisperPrompt(tenantId?: string | null): Promise<string> {
  if (!tenantId) {
    return DEFAULT_FALLBACK_PROMPT;
  }

  try {
    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, businessType: true },
    });

    if (!tenant) {
      return DEFAULT_FALLBACK_PROMPT;
    }

    // Fetch unique item names from recent sales & purchases (up to 30 most recent items)
    const [sales, purchases, knowledge] = await Promise.all([
      (prisma as any).sale.findMany({
        where: { tenantId },
        select: { itemName: true },
        distinct: ['itemName'],
        take: 20,
      }),
      (prisma as any).purchase.findMany({
        where: { tenantId },
        select: { itemName: true },
        distinct: ['itemName'],
        take: 20,
      }),
      (prisma as any).knowledgeItem.findMany({
        where: { tenantId },
        select: { keywords: true, question: true },
        take: 10,
      }),
    ]);

    const itemSet = new Set<string>();

    sales.forEach((s: any) => { if (s.itemName && s.itemName.length > 1) itemSet.add(s.itemName.trim()); });
    purchases.forEach((p: any) => { if (p.itemName && p.itemName.length > 1) itemSet.add(p.itemName.trim()); });

    knowledge.forEach((k: any) => {
      try {
        const kwArray = JSON.parse(k.keywords || "[]");
        if (Array.isArray(kwArray)) {
          kwArray.forEach((kw: string) => { if (kw && kw.length > 1) itemSet.add(kw.trim()); });
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    const tenantItems = Array.from(itemSet).slice(0, 30); // Max 30 items to fit in ~150 tokens

    let promptText = `نظام مبيعات ومشتريات لشركة ${tenant.name || "عامة"}.`;
    if (tenant.businessType) {
      promptText += ` النشاط: ${tenant.businessType}.`;
    }

    if (tenantItems.length > 0) {
      promptText += ` الأصناف والمصطلحات: ${tenantItems.join("، ")}.`;
    } else {
      promptText += ` المصطلحات: ${DEFAULT_FALLBACK_PROMPT}`;
    }

    return promptText;
  } catch (err) {
    console.error("[Whisper Dynamic Prompt Error]", err);
    return DEFAULT_FALLBACK_PROMPT;
  }
}
