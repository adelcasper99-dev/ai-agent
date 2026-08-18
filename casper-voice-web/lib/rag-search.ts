import { prismaSystem as prisma } from "./prisma";

export interface RAGSearchResult {
  id: string;
  topic: string;
  category: string;
  solution: string;
  score: number;
}

export async function searchKnowledgeBase(
  queryText: string,
  limit: number = 3,
  tenantId?: string
): Promise<RAGSearchResult[]> {
  if (!queryText || !queryText.trim()) return [];

  const cleanQuery = queryText.trim().toLowerCase();
  const queryWords = cleanQuery.split(/\s+/).filter((w) => w.length > 1);

  const items = await prisma.knowledgeItem.findMany({
    where: tenantId
      ? {
          OR: [{ tenantId }, { tenantId: null }],
        }
      : {},
  });
  const scoredResults: RAGSearchResult[] = [];

  for (const item of items) {
    const textToMatch = `${item.question} ${item.keywords} ${item.answer}`.toLowerCase();
    let matches = 0;

    for (const word of queryWords) {
      if (textToMatch.includes(word)) {
        matches++;
      }
    }

    if (matches > 0 || queryWords.length === 0) {
      const score = Math.min(1.0, matches / Math.max(1, queryWords.length));
      scoredResults.push({
        id: item.id,
        topic: item.question,
        category: "general",
        solution: item.answer,
        score,
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults.slice(0, limit);
}
