import { prisma } from './prisma';

export interface MemoryEntry {
  id: string;
  tenantId: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveMemoryParams {
  category: 'customer_alias' | 'unit_preference' | 'product_alias' | 'general_preference';
  key: string;
  value: string;
  confidence?: number;
  source?: 'explicit_statement' | 'confirmed_correction';
}

/**
 * Rejects saving pure monetary figures / balances into merchant memory to preserve accounting integrity.
 */
function containsForbiddenFinancialData(value: string): boolean {
  const financialPatterns = [
    /(رصيد|مديونية|دين|حساب|أرباح|مبيعات)/i,
    /\d+\s*(جنيه|ج|إيجب|egp|\$)/i,
    /بـ\s*\d+/i,
  ];
  return financialPatterns.some(pattern => pattern.test(value));
}


/**
 * Resolves up to 3 relevant merchant memories based on input text keywords.
 */
export async function resolveMerchantMemories(tenantId: string, text: string): Promise<MemoryEntry[]> {
  if (!tenantId || !text || text.trim().length === 0) {
    return [];
  }

  try {
    const memories = await prisma.merchantMemory.findMany({
      where: { tenantId },
      orderBy: [
        { confidence: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: 20
    });

    if (memories.length === 0) {
      return [];
    }

    const lowerText = text.toLowerCase();
    // Key must appear as a substring inside the user's message text only (not the reverse)
    const matched = memories.filter(m => lowerText.includes(m.key.toLowerCase()));

    return matched.slice(0, 3);
  } catch (error) {
    console.error('[MerchantMemory] Error resolving memories:', error);
    return [];
  }
}


function stripQuotes(str: string): string {
  return str.replace(/^["'«»“”\s]+|["'«»“”\s]+$/g, '').trim();
}

/**
 * Upserts a merchant memory entry with financial sanitization guardrails.
 */
export async function saveMerchantMemory(
  tenantId: string,
  params: SaveMemoryParams
): Promise<MemoryEntry | null> {
  if (!tenantId || !params.key || !params.value) {
    return null;
  }

  const cleanKey = stripQuotes(params.key);
  const cleanValue = stripQuotes(params.value);

  // Guardrail: Block financial figures in memory
  if (containsForbiddenFinancialData(cleanValue)) {
    console.warn(`[MerchantMemory] Financial data rejected from memory: ${cleanValue}`);
    return null;
  }

  try {
    const result = await prisma.merchantMemory.upsert({
      where: {
        tenantId_category_key: {
          tenantId,
          category: params.category,
          key: cleanKey,
        }
      },
      update: {
        value: cleanValue,
        confidence: params.confidence ?? 1.0,
        source: params.source ?? 'explicit_statement',
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        category: params.category,
        key: cleanKey,
        value: cleanValue,
        confidence: params.confidence ?? 1.0,
        source: params.source ?? 'explicit_statement',
      }
    });

    return result;
  } catch (error) {
    console.error('[MerchantMemory] Error saving memory:', error);
    return null;
  }
}

/**
 * Asynchronously extracts explicit alias declarations from merchant messages.
 * e.g. "أبو صلاح ده أحمد محمد" -> key: "أبو صلاح", value: "أحمد محمد"
 */
export async function extractAndPersistMemory(
  tenantId: string,
  userText: string
): Promise<void> {
  if (!tenantId || !userText) return;

  try {
    const sanitizedText = stripQuotes(userText);
    // Check for explicit alias statement patterns: "X ده Y" or "X هو Y" or "X يعني Y"
    const aliasRegex = /^\s*(.+?)\s+(ده|هو|يعني)\s+(.+?)\s*$/i;
    const match = sanitizedText.match(aliasRegex);

    if (match) {
      const rawKey = stripQuotes(match[1].replace(/^(هو|ده|سجل|خزن|افتكر|احفظ)\s+/i, ''));
      const rawVal = stripQuotes(match[3]);

      if (rawKey.length >= 2 && rawVal.length >= 2) {
        await saveMerchantMemory(tenantId, {
          category: 'customer_alias',
          key: rawKey,
          value: rawVal,
          confidence: 1.0,
          source: 'explicit_statement'
        });
      }
    }
  } catch (err) {
    console.error('[MerchantMemory] Async extraction failed:', err);
  }
}

