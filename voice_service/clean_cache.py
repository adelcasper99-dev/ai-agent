import os
import shutil
import sys

def clean_pycache(root_dir: str):
    """
    Recursively finds and removes all __pycache__ folders and .pyc files.
    """
    removed_dirs = 0
    removed_files = 0
    for root, dirs, files in os.walk(root_dir):
        for d in dirs:
            if d == "__pycache__":
                dir_path = os.path.join(root, d)
                try:
                    shutil.rmtree(dir_path)
                    removed_dirs += 1
                except Exception as e:
                    print(f"Failed to remove directory {dir_path}: {e}")
        for f in files:
            if f.endswith(".pyc") or f.endswith(".pyo"):
                file_path = os.path.join(root, f)
                try:
                    os.remove(file_path)
                    removed_files += 1
                except Exception as e:
                    print(f"Failed to remove file {file_path}: {e}")

    print(f"Successfully cleaned {removed_dirs} __pycache__ directories and {removed_files} compiled Python files.")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    clean_pycache(target)
