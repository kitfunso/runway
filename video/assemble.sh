#!/usr/bin/env bash
# Builds out/runway-demo.mp4 from gfx/ scenes and captures/ clips. Run: bash video/assemble.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/tmp
ENC=(-an -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30)

# fit <src> <seconds> <dst>: scale to 1080p and freeze the last frame to fill the slot
fit() { ffmpeg -v error -y -i "$1" -vf "scale=1920:1080,fps=30,tpad=stop_mode=clone:stop_duration=$2" -t "$2" "${ENC[@]}" "$3"; }

declare -A SLOT=([s1]=11 [s2]=14 [s3]=8 [s4]=15 [s5]=17 [s6]=18 [s7]=13 [s8]=10 [s9]=7)
for s in s1 s2 s9; do fit "gfx/$s.mp4" "${SLOT[$s]}" "out/tmp/$s.mp4"; done
for s in s3 s4 s5 s6 s7 s8; do
  d=${SLOT[$s]}
  if [ -f "gfx/chip-$s.png" ]; then
    ffmpeg -v error -y -i "captures/$s.mp4" -loop 1 -t "$d" -i "gfx/chip-$s.png" -filter_complex \
      "[1]format=rgba,fade=in:st=0.4:d=0.35:alpha=1,fade=out:st=$(awk "BEGIN{print $d - 0.7}"):d=0.35:alpha=1[c];[0][c]overlay=0:0" \
      -t "$d" "${ENC[@]}" "out/tmp/$s.mp4"
  else
    fit "captures/$s.mp4" "$d" "out/tmp/$s.mp4"
  fi
done
: > out/tmp/list.txt
for s in s1 s2 s3 s4 s5 s6 s7 s8 s9; do echo "file '$s.mp4'" >> out/tmp/list.txt; done
ffmpeg -v error -y -f concat -safe 0 -i out/tmp/list.txt -c copy out/runway-demo.mp4
ffprobe -v error -show_entries format=duration,size -of csv=p=0 out/runway-demo.mp4
