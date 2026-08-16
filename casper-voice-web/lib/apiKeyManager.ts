import { prisma } from "./prisma";
import { decryptField } from "./crypto";

// Track in-memory exhausted ENV keys (e.g. "gemini:KEY", "groq:KEY")
const _exhaustedEnvKeys = new Set<string>();

export async function getValidApiKey(provider: string = "gemini"): Promise<string> {
  const normProvider = provider.toLowerCase();

  // 1. Try DB Pool first
  let validKeyRecord = await prisma.apiKeyPool.findFirst({
    where: {
      provider: { equals: normProvider },
      isActive: true,
      isExhausted: false,
    },
    orderBy: {
      addedAt: 'asc'
    }
  });

  if (!validKeyRecord) {
    // If all DB keys are exhausted, check if any exhausted key passed the 24-hour limit
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredKeys = await prisma.apiKeyPool.findMany({
      where: {
        provider: { equals: normProvider },
        isActive: true,
        isExhausted: true,
        exhaustedAt: {
          lt: twentyFourHoursAgo,
        }
      }
    });

    if (expiredKeys.length > 0) {
      await prisma.apiKeyPool.updateMany({
        where: {
          id: { in: expiredKeys.map(k => k.id) }
        },
        data: {
          isExhausted: false,
          exhaustedAt: null,
        }
      });
      validKeyRecord = await prisma.apiKeyPool.findFirst({
        where: { provider: { equals: normProvider }, isActive: true, isExhausted: false }
      });
    }
  }

  if (validKeyRecord) {
    return decryptField(validKeyRecord.keyString);
  }

  // 2. Scan ENV Variables pool (e.g. GROQ_API_KEY, GROQ_API_KEY_1, GROQ_API_KEYS="key1,key2"...)
  const envPrefix = `${normProvider.toUpperCase()}_API_KEY`;
  const envKeys: string[] = [];

  for (const [envKey, envVal] of Object.entries(process.env)) {
    if (envKey.toUpperCase().startsWith(envPrefix) && envVal && typeof envVal === "string") {
      const parts = envVal.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);
      for (const trimmed of parts) {
        if (trimmed && !_exhaustedEnvKeys.has(`${normProvider}:${trimmed}`)) {
          envKeys.push(trimmed);
        }
      }
    }
  }

  if (envKeys.length > 0) {
    return envKeys[0];
  }

  throw new Error(`[ApiKeyManager] No valid API keys available for ${provider}.`);
}

export async function markKeyExhausted(keyString: string, provider: string = "gemini"): Promise<void> {
  const normProvider = provider.toLowerCase();
  const trimmedKey = keyString.trim();
  _exhaustedEnvKeys.add(`${normProvider}:${trimmedKey}`);

  try {
    const keys = await prisma.apiKeyPool.findMany({
      where: { provider: { equals: normProvider } }
    });
    const match = keys.find(k => decryptField(k.keyString) === trimmedKey || k.keyString === trimmedKey);
    if (match) {
      await prisma.apiKeyPool.update({
        where: { id: match.id },
        data: {
          isExhausted: true,
          exhaustedAt: new Date()
        }
      });
      console.log(`[ApiKeyManager] Key for ${normProvider} marked as exhausted in DB.`);
    } else {
      console.warn(`[ApiKeyManager] Key for ${normProvider} marked as exhausted in memory.`);
    }
  } catch (err) {
    console.error(`[ApiKeyManager] Failed to mark key as exhausted:`, err);
  }
}

export function _resetExhaustedKeysForTesting(): void {
  _exhaustedEnvKeys.clear();
}


