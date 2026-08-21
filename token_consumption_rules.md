# 🪙 Token Consumption & Context Window Rules

## 📊 Summary Table
| Trigger Condition | Threshold / Value | Action Taken | Rule / Standard |
| :--- | :--- | :--- | :--- |
| **Auto-Condense Trigger** | **25 Turns** OR **~150k Tokens** (75% of 200k window) | Automatically run `/context-condense` to compress state into `.antigravity/condense-state.yaml` | `Permanent Context Condense Protocol` |
| **Condense Reduction Target** | `< 60%` token reduction | Re-run deeper compression pass before accepting result | `Context Condense Quality Guard` |
| **Hallucination / Token Limit Warning** | Context degradation detected / token saturation | Emit warning: `⚠️ Context Limit Reached: I am starting to hallucinate due to token limits. Please start a new chat session to restore peak performance.` | `Context Degradation & Hallucination Protocol` |

---

## 🚀 Options & Recommendations

### Option 1: Keep Context Auto-Condensation Active (Recommended)
* Let the system auto-condense at 25 turns or ~150k tokens to preserve facts in `.antigravity/condense-state.yaml`.
* Start a fresh chat session whenever the context limit warning is displayed.

### Option 2: Manual Condensation (`/context-condense`)
* Manually invoke `/context-condense` at any time during long refactoring sessions.

---

## ⚖️ Strategic Insight

### Benefits
* **Prevents Hallucinations**: Keeps context size under 75% limit.
* **100% Fact Persistence**: Retains all architectural decisions in `condense-state.yaml`.

### Risks
* Extremely long chats without starting a new session can slow down response latency.

### Recommendation
* Start a new chat when instructed by the `⚠️ Context Limit Reached` warning to maintain peak speed and precision.
