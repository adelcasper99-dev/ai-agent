import { NextRequest } from "next/server";

export function isInternalAuthValid(req: NextRequest): boolean {
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET || "casper-voice-internal-secret-9988776655";
  
  if (internalSecret && internalSecret === expectedSecret) {
    return true;
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const apiKey = process.env.INTERNAL_API_KEY || process.env.INTERNAL_SERVICE_SECRET || "test-internal-secret-key-123";
  
  if (token && (token === apiKey || token === expectedSecret)) {
    return true;
  }

  return false;
}
