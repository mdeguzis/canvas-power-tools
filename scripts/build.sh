#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
DIST="$ROOT/dist"

VERSION=$(python3 -c "import json; print(json.load(open('$SRC/manifest.json'))['version'])")

build_browser() {
  local browser="$1"
  local out="$DIST/$browser"

  echo "Building for $browser..."
  rm -rf "$out"
  cp -r "$SRC" "$out"

  if [ "$browser" = "firefox" ]; then
    python3 - <<PYEOF
import json, pathlib
p = pathlib.Path("$out/manifest.json")
m = json.loads(p.read_text())
m.setdefault("browser_specific_settings", {})["gecko"] = {
    "id": "canvas-power-tools@extension",
    "strict_min_version": "109.0"
}
p.write_text(json.dumps(m, indent=2))
PYEOF
  fi

  local zip="$DIST/canvas-power-tools-${VERSION}-${browser}.zip"
  rm -f "$zip"
  (cd "$out" && zip -r "$zip" . -x "*.DS_Store" -x "__MACOSX/*")
  echo "  -> $zip"
}

mkdir -p "$DIST"
build_browser chrome
build_browser firefox

echo ""
echo "Done. Artifacts in $DIST/"
ls -lh "$DIST/"*.zip
