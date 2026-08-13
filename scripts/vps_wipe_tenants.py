import sqlite3, sys
db_path = sys.argv[1] if len(sys.argv) > 1 else "/root/ai-support-agent/casper-voice-web/prisma/dev.db"
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = OFF")
c = conn.cursor()
TABLES = ["CustomerLedgerEntry","JournalEntry","Sale","Expense","Purchase","SupplierPayment","Appointment","Customer","Supplier","Product","ChatMessage","ConversationState","MerchantMemory","InteractionDiagnostics","KnowledgeItem","RejectedToolCall","TokenUsage","CsatRating","AuditLog","Conversation","PendingTenantRequest","PendingBusinessConnection","ProcessedUpdate","AdminLinkAudit","AdminLinkToken","Tenant"]
total = 0
for t in TABLES:
    try:
        cnt = c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        if cnt > 0:
            c.execute(f"DELETE FROM {t}")
            total += cnt
            print(f"WIPED {t}: {cnt}")
    except Exception as e:
        print(f"SKIP {t}: {e}")
conn.commit()
conn.execute("PRAGMA foreign_keys = ON")
print("\n=== VERIFY ===")
for t in ["Tenant","Sale","Expense","Customer"]:
    print(f"{t}: {c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]}")
conn.close()
print(f"Total deleted: {total}")
