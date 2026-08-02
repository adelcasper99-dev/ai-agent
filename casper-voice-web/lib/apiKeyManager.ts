import { prisma } from "./prisma";

// Cache valid keys in memory to prevent excessive DB calls, but check DB if we run out.
let _validKeysCache: string[] = [];

export async function getValidApiKey(provider: string = "gemini"): Promise<string> {
  // Try to find a valid key that is not exhausted
  let validKeyRecord = await prisma.apiKeyPool.findFirst({
    where: {
      provider,
      isActive: true,
      isExhausted: false,
    },
    orderBy: {
      addedAt: 'asc' // pick the oldest first or you can randomize
    }
  });

  if (!validKeyRecord) {
    // If all keys are exhausted, check if any exhausted key has passed the 24-hour limit
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredKeys = await prisma.apiKeyPool.findMany({
      where: {
        provider,
        isActive: true,
        isExhausted: true,
        exhaustedAt: {
          lt: twentyFourHoursAgo, // exhausted before 24h ago
        }
      }
    });

    if (expiredKeys.length > 0) {
      // Reset them
      await prisma.apiKeyPool.updateMany({
        where: {
          id: { in: expiredKeys.map(k => k.id) }
        },
        data: {
          isExhausted: false,
          exhaustedAt: null,
        }
      });
      // Try fetching again
      validKeyRecord = await prisma.apiKeyPool.findFirst({
        where: { provider, isActive: true, isExhausted: false }
      });
    }
  }

  if (validKeyRecord) {
    return validKeyRecord.keyString;
  }

  // Fallback to environment variable if no key in DB or all are strictly exhausted and within 24h
  console.warn(`[ApiKeyManager] No valid API keys found in DB for provider ${provider}. Falling back to ENV variables.`);
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  
  throw new Error(`[ApiKeyManager] No valid API keys available for ${provider}.`);
}

export async function markKeyExhausted(keyString: string, provider: string = "gemini"): Promise<void> {
  try {
    // Check if it's the environment key, we can't update it in DB if it's not there, but let's try
    const existing = await prisma.apiKeyPool.findUnique({
      where: { keyString }
    });
    if (existing) {
      await prisma.apiKeyPool.update({
        where: { keyString },
        data: {
          isExhausted: true,
          exhaustedAt: new Date()
        }
      });
      console.log(`[ApiKeyManager] Key for ${provider} marked as exhausted (429 Rate Limit).`);
    } else {
      // If it's an ENV key that isn't in DB, maybe we should insert it as exhausted?
      // For now, just log.
      console.warn(`[ApiKeyManager] The key that got exhausted is not in the DB pool.`);
    }
  } catch (err) {
    console.error(`[ApiKeyManager] Failed to mark key as exhausted:`, err);
  }
}
