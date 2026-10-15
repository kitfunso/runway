#!/usr/bin/env bash
# Cuts the recorded take into fixed-length scene clips. Run: bash video/cut.sh
set -euo pipefail
cd "$(dirname "$0")/captures"
MAIN=raw/f42b470207072ac9ecf8d708903e3e44.webm
INV=raw/adcb4b7f2d8b4e235cdcbf973dbe4b3b.webm
# Playwright drew the 1440x810 page into the top-left of a 1920x1080 frame.
VF="crop=1440:810:0:0,scale=1920:1080:flags=lanczos,fps=30,format=yuv420p"
ENC=(-an -c:v libx264 -preset veryfast -crf 18)

# part <src> <in> <out> <speed> <name>
part() { ffmpeg -v error -y -ss "$2" -to "$3" -i "$1" -vf "setpts=PTS/$4,$VF" "${ENC[@]}" "parts/$5.mp4"; }
# scene <slot seconds> <name> <parts...>: concat parts, freeze the last frame to fill the slot
scene() {
  local slot=$1 name=$2; shift 2
  : > "parts/$name.txt"
  for p in "$@"; do echo "file '$p.mp4'" >> "parts/$name.txt"; done
  ffmpeg -v error -y -f concat -safe 0 -i "parts/$name.txt" -vf "tpad=stop_mode=clone:stop_duration=$slot" -t "$slot" "${ENC[@]}" "$name.mp4"
}
mkdir -p parts

part "$MAIN" 15.4 34.5 1 s4a;     scene 23 s4 s4a
part "$MAIN" 34.5 41.5 1.2 s5a; part "$MAIN" 41.5 44.5 1 s5b; part "$MAIN" 76.9 82.3 1 s5c; scene 17 s5 s5a s5b s5c
part "$MAIN" 83.5 87.5 1 s6a; part "$INV" 10.5 22.5 2 s6b; part "$MAIN" 110.2 118.2 1 s6c; scene 18 s6 s6a s6b s6c
part "$MAIN" 118.7 131.7 1 s7a;   scene 13 s7 s7a
part "$MAIN" 131.9 141.9 1 s8a;   scene 10 s8 s8a
for s in s4 s5 s6 s7 s8; do echo "$s $(ffprobe -v error -show_entries format=duration -of csv=p=0 $s.mp4)"; done
