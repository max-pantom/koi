#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 7 ]]; then
  echo "Usage: $0 APP_BUNDLE PROCESS_NAME OUTPUT_PNG X Y WIDTH HEIGHT" >&2
  exit 2
fi

app_bundle=$1
process_name=$2
output_png=$3
capture_x=$4
capture_y=$5
capture_width=$6
capture_height=$7

if [[ ! -d "$app_bundle" ]]; then
  echo "App bundle not found: $app_bundle" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_png")"
open "$app_bundle"
for _attempt in {1..20}; do
  if osascript \
    -e "tell application \"$process_name\" to activate" \
    -e "tell application \"System Events\" to tell process \"$process_name\" to set position of window 1 to {$capture_x, $capture_y}" \
    -e "tell application \"System Events\" to tell process \"$process_name\" to set size of window 1 to {$capture_width, $capture_height}"; then
    break
  fi
  sleep 0.4
done
screencapture -x -R"$capture_x,$capture_y,$capture_width,$capture_height" "$output_png"
echo "$output_png"
