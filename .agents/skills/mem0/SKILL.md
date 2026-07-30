---
name: mem0
description: >
  Dedicated long-term persistent memory engine for Antigravity Agent.
  Stores, searches, lists, and invalidates persistent user facts, architecture decisions, financial rules, and preferences.
  Triggers on: "/mem0", "remember this", "search memory", "get memory", "what is in memory".
---

# Mem0 — Dedicated Persistent Memory Skill

You are operating with **Mem0 Dedicated Memory Engine**.

**Global Storage Location**: `C:\Users\TheExpert\.gemini\antigravity-ide\mem0_store.json` (Persisted across sessions & projects).

---

## ⚡ CLI Commands

Run commands via black-box execution:

```bash
# Add new memory
python scripts/mem0_engine.py add "Content text here" "category" "tag1,tag2"

# Search memory by query
python scripts/mem0_engine.py search "query keyword"

# List all memories or by category
python scripts/mem0_engine.py list [category]

# Delete stale memory
python scripts/mem0_engine.py delete <memory_id>
```

---

## 🧠 Categories
* `user_preference`: User coding preferences, formatting rules.
* `architecture`: System infrastructure, PM2 ports, database setup.
* `security`: JWT secrets, Auth rules, RBAC matrix.
* `financial_rules`: Decimal.js precision, ledger debit/credit balance.
* `workflow`: POS terminal sync, return workflows, support agent RAG.
