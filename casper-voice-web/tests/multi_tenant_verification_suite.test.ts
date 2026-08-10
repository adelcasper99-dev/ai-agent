import { describe, it, expect } from "vitest";
import { prisma } from "../lib/prisma";
import { runWithTenant } from "../lib/prisma-tenant-extension";
import * as fs from "fs";
import * as path from "path";

describe("Multi-Tenant Empirical Verification Suite", () => {
  it("runs all 4 empirical checks", async () => {
  console.log("=================================================");
  console.log("🚀 CASPER MULTI-TENANT EMPIRICAL VERIFICATION SUITE");
  console.log("=================================================\n");

  let failures = 0;

  // --- CHECK 1 & 3: Multi-Tenant Isolation, Update & Delete ---
  console.log("🔹 [CHECK 1 & 3] Testing Multi-Tenant Isolation, Update & Delete...");
  const tenantA = "test-tenant-alpha-111";
  const tenantB = "test-tenant-beta-222";

  try {
    // Provision actual Tenants in database to satisfy foreign key constraints
    await (prisma as any).tenant.upsert({
      where: { id: tenantA },
      update: {},
      create: { id: tenantA, name: "Tenant Alpha" },
    });
    await (prisma as any).tenant.upsert({
      where: { id: tenantB },
      update: {},
      create: { id: tenantB, name: "Tenant Beta" },
    });

    // Seed item for Tenant A
    const itemA = await runWithTenant(tenantA, async () => {
      return await (prisma as any).knowledgeItem.create({
        data: {
          question: "سؤال تجريبي لتينانت أ",
          answer: "إجابة تينانت أ",
          keywords: JSON.stringify(["أ"]),
        },
      });
    });
    console.log(`   ✅ Tenant A created KnowledgeItem ID: ${itemA.id}`);

    // Read attempt from Tenant B (should return null/empty)
    const itemsFromB = await runWithTenant(tenantB, async () => {
      return await (prisma as any).knowledgeItem.findMany();
    });
    const foundB = itemsFromB.find((i: any) => i.id === itemA.id);

    if (foundB) {
      console.error("   ❌ FAIL: Tenant B was able to read Tenant A's item!");
      failures++;
    } else {
      console.log("   ✅ SUCCESS: Tenant B cannot see Tenant A's data (Isolated).");
    }

    // Update attempt by Tenant A (Owner) -> should succeed
    const updatedA = await runWithTenant(tenantA, async () => {
      return await (prisma as any).knowledgeItem.update({
        where: { id: itemA.id },
        data: { answer: "إجابة تينانت أ المحدثة" },
      });
    });

    if (updatedA.answer === "إجابة تينانت أ المحدثة") {
      console.log("   ✅ SUCCESS: Owner (Tenant A) successfully updated item.");
    } else {
      console.error("   ❌ FAIL: Owner update failed or no-oped!");
      failures++;
    }

    // Update attempt by Tenant B (Non-Owner) -> should throw Unauthorized
    let updateByBFailed = false;
    try {
      await runWithTenant(tenantB, async () => {
        await (prisma as any).knowledgeItem.update({
          where: { id: itemA.id },
          data: { answer: "اختراق من تينانت ب" },
        });
      });
    } catch (e: any) {
      updateByBFailed = true;
      console.log(`   ✅ SUCCESS: Non-owner (Tenant B) update blocked! (${e.message})`);
    }

    if (!updateByBFailed) {
      console.error("   ❌ FAIL: Non-owner (Tenant B) was able to update Tenant A's item!");
      failures++;
    }

    // Delete attempt by Tenant A (Owner) -> should succeed
    await runWithTenant(tenantA, async () => {
      await (prisma as any).knowledgeItem.delete({
        where: { id: itemA.id },
      });
    });
    console.log("   ✅ SUCCESS: Owner (Tenant A) successfully deleted item.");

    // Verify item is gone
    const itemCheck = await runWithTenant(tenantA, async () => {
      return await (prisma as any).knowledgeItem.findFirst({
        where: { id: itemA.id },
      });
    });

    if (!itemCheck) {
      console.log("   ✅ SUCCESS: Item deletion verified.");
    } else {
      console.error("   ❌ FAIL: Item still exists after delete!");
      failures++;
    }

    // Clean up test tenants
    await (prisma as any).tenant.delete({ where: { id: tenantA } });
    await (prisma as any).tenant.delete({ where: { id: tenantB } });

  } catch (err: any) {
    console.error("   ❌ EXCEPTION in Check 1 & 3:", err);
    failures++;
  }

  // --- CHECK 2: Re-grep for new PrismaClient() in app/ and lib/ ---
  console.log("\n🔹 [CHECK 2] Re-grepping for orphan 'new PrismaClient()' in app/ and lib/...");
  function scanDir(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(scanDir(fullPath));
      } else if (file.endsWith(".ts") || file.endsWith(".js") || file.endsWith(".tsx")) {
        if (fullPath.includes("lib\\prisma.ts") || fullPath.includes("lib/prisma.ts")) continue;
        const content = fs.readFileSync(fullPath, "utf8");
        if (content.includes("new PrismaClient()")) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  const appDir = path.join(process.cwd(), "app");
  const libDir = path.join(process.cwd(), "lib");
  const orphanFiles = [...scanDir(appDir), ...scanDir(libDir)];

  if (orphanFiles.length === 0) {
    console.log("   ✅ SUCCESS: Exactly 0 orphan 'new PrismaClient()' calls found in app/ and lib/.");
  } else {
    console.error(`   ❌ FAIL: Found ${orphanFiles.length} orphan PrismaClient instances:`, orphanFiles);
    failures++;
  }

  // --- CHECK 4: Verify lib/session.ts HAS ZERO PRISMA CODE IMPORTS ---
  console.log("\n🔹 [CHECK 4] Verifying lib/session.ts import statements...");
  const sessionPath = path.join(process.cwd(), "lib", "session.ts");
  const sessionContent = fs.readFileSync(sessionPath, "utf8");
  const lines = sessionContent.split("\n");

  const importLinesWithPrisma = lines.filter(
    (line) => line.trim().startsWith("import ") && (line.includes("prisma") || line.includes("@prisma/client"))
  );

  if (importLinesWithPrisma.length === 0) {
    console.log("   ✅ SUCCESS: lib/session.ts import statements have ZERO Prisma references.");
  } else {
    console.error("   ❌ FAIL: lib/session.ts contains Prisma imports:", importLinesWithPrisma);
    failures++;
  }

  console.log("\n=================================================");
  if (failures === 0) {
    console.log("🎉 ALL 4 EMPIRICAL CHECKS PASSED PERFECTLY!");
  } else {
    console.error(`❌ VERIFICATION FAILED: ${failures} check(s) failed.`);
  }
  console.log("=================================================");

    expect(failures).toBe(0);
  });
});
