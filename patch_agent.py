import sys
import os

file_path = 'voice_service/agent.py'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

start_idx = -1
for i, line in enumerate(lines):
    if line == '    try:' and 'create_agent_session_with_failover' in lines[i+1]:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start index")
    sys.exit(1)

end_idx = -1
for i in range(start_idx + 1, len(lines)):
    if lines[i] == '    except Exception as e:':
        end_idx = i
        break

if end_idx == -1:
    print("Could not find end index")
    sys.exit(1)

lines[start_idx] = '    for llm_attempt in range(2):\n        try:'
for i in range(start_idx + 1, end_idx):
    lines[i] = '    ' + lines[i]

lines.insert(end_idx, '            break')
end_idx += 1

except_logic = """        except Exception as e:
            err_str = str(e).lower()
            if ("insufficient_quota" in err_str or "429" in err_str or "quota" in err_str) and llm_attempt < 1:
                print(f"[LLM QUOTA EXCEEDED] Provider {provider} failed. Switching to OpenAI...")
                provider = "openai"
                try:
                    import sqlite3, os
                    db_path = os.path.join(os.path.dirname(__file__), "..", "casper-voice-web", "dev.db")
                    if os.path.exists(db_path):
                        conn = sqlite3.connect(db_path)
                        conn.execute("UPDATE Setting SET value = 'openai' WHERE key = 'VOICE_PROVIDER'")
                        conn.commit()
                        conn.close()
                except Exception as dbe:
                    print("[DB Fallback Error]", dbe)
                continue
"""
lines[end_idx] = except_logic + lines[end_idx].replace('    except Exception as e:', '')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("Successfully patched agent.py")
