"""Create (or update) the Hugging Face Space and upload the app, using the HF API.

Usage (from the project folder):
    .venv\\Scripts\\python scripts\\deploy_hf.py

Reads from the local .env file (never printed):
    HF_TOKEN        a Hugging Face token with Write permission (required)
    OPENAI_API_KEY  stored as a Space secret (required)
    DATABASE_URL    stored as a Space secret if it's a Postgres URL (optional;
                    without it the demo uses a temporary SQLite file)

Only files committed to git are uploaded, so .env and local databases can't leak.
After the first run, pushes to GitHub deploy automatically (see .github/workflows/deploy-hf.yml)
once HF_TOKEN is also added as a GitHub secret.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from dotenv import dotenv_values
from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
SPACE_NAME = "interview-coach"
SKIP_PREFIXES = ("docs/media/",)  # binary files that Spaces reject without Git LFS


def main() -> None:
    env = dotenv_values(ROOT / ".env")
    token = env.get("HF_TOKEN")
    openai_key = env.get("OPENAI_API_KEY")
    if not token or not openai_key:
        sys.exit("Add HF_TOKEN and OPENAI_API_KEY to .env first (see docs/DEPLOY.md).")

    api = HfApi(token=token)
    user = api.whoami()["name"]
    space_id = f"{user}/{SPACE_NAME}"

    print(f"1/4 Creating Space {space_id} (if it doesn't exist yet)...")
    api.create_repo(space_id, repo_type="space", space_sdk="docker", private=False, exist_ok=True)

    print("2/4 Setting DEMO_MODE and secrets...")
    api.add_space_variable(space_id, "DEMO_MODE", "true")
    api.add_space_secret(space_id, "OPENAI_API_KEY", openai_key)
    database_url = env.get("DATABASE_URL", "")
    if database_url.startswith(("postgres://", "postgresql://")):
        api.add_space_secret(space_id, "DATABASE_URL", database_url)
        print("    DATABASE_URL secret set (Postgres).")
    else:
        print("    No Postgres DATABASE_URL in .env; the demo will use a temporary database.")

    print("3/4 Uploading committed files...")
    files = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.splitlines()
    with tempfile.TemporaryDirectory() as tmp:
        for name in files:
            if name.startswith(SKIP_PREFIXES):
                continue
            target = Path(tmp) / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        # Spaces read their settings from the README's front matter.
        shutil.copy2(ROOT / "deploy/huggingface/README.md", Path(tmp) / "README.md")
        api.upload_folder(
            repo_id=space_id,
            repo_type="space",
            folder_path=tmp,
            delete_patterns="*",  # mirror exactly: remove files that no longer exist
            commit_message="Deploy from local script",
        )

    subdomain = space_id.lower().replace("/", "-").replace("_", "-")
    print("4/4 Done. The Space is now building (about 5 minutes).")
    print(f"    Build logs: https://huggingface.co/spaces/{space_id}")
    print(f"    Live app:   https://{subdomain}.hf.space")


if __name__ == "__main__":
    main()
