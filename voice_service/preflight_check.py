import os
import sys
import logging
from pathlib import Path

logger = logging.getLogger("preflight_check")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def run_preflight():
    """
    Two-Stage Pre-flight diagnostic check for LiveKit + Gemini Agent.
    Stage 1: Soft Pre-flight check (auto-loads .env if present, warns if missing, defers to Web UI dynamic settings).
    Stage 2: Final Guard is enforced dynamically inside create_agent_session() in agent.py.
    """
    logger.info("🔍 Running Casper Pre-flight Diagnostic Assertions...")

    # Attempt to load casper-voice-web/.env or root .env
    try:
        from dotenv import load_dotenv
        web_env = Path(__file__).parent.parent / "casper-voice-web" / ".env"
        if web_env.exists():
            load_dotenv(web_env)
            logger.info(f"✅ Loaded environment from {web_env.name}")
        else:
            load_dotenv()
    except ImportError:
        logger.debug("dotenv module not installed; relying on system environment variables.")

    allow_offline = os.environ.get("ALLOW_OFFLINE_DEV", "0").lower() in ["true", "1"]
    errors = []

    # 1. Check GEMINI_API_KEY
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key:
        logger.warning("⚠️ GEMINI_API_KEY not found in local environment or .env file.")
        logger.info("ℹ️ Pre-flight deferring key verification to Web UI dynamic settings (Final Guard active in agent.py).")
    else:
        logger.info("✅ Local GEMINI_API_KEY found.")

    # 2. Dependency Audit
    try:
        import livekit.plugins.google as livekit_google
        logger.info("✅ livekit-plugins-google is installed and importable.")
    except ImportError:
        errors.append("❌ livekit-plugins-google is missing. Run `pip install livekit-plugins-google`.")

    # 3. Model Ping (only if key exists locally and not offline)
    if gemini_key and not allow_offline:
        try:
            import google.genai as genai
            client = genai.Client(api_key=gemini_key)
            client.models.get(model="gemini-2.0-flash")
            logger.info("✅ Gemini API Key and Model Connectivity verified.")
        except Exception as e:
            err_msg = str(e)
            if "API_KEY_INVALID" in err_msg or "INVALID_ARGUMENT" in err_msg:
                errors.append(f"❌ Invalid local GEMINI_API_KEY provided: {err_msg}")
            else:
                logger.warning(f"⚠️ Gemini API Ping Warning: {err_msg}")
    elif allow_offline:
        logger.info("ℹ️ ALLOW_OFFLINE_DEV=1 set; skipping remote API connectivity ping.")

    # Evaluate Critical Errors (e.g. missing required packages)
    if errors:
        logger.error("🚨 PRE-FLIGHT DIAGNOSTICS FAILED:")
        for err in errors:
            logger.error(err)
        if not allow_offline:
            sys.exit(1)
    else:
        logger.info("🚀 Pre-flight checks completed cleanly!")

if __name__ == "__main__":
    run_preflight()
