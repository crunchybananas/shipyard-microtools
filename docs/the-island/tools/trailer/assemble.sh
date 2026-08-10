#!/usr/bin/env bash
# assemble.sh (#142) — frames → the 90s draft master. Straight cuts + 0.5s fades,
# the title card last, scored quietly with an era stem if one exists on disk.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
FR="$HERE/frames"
OUT="$HERE/out"
mkdir -p "$OUT"

# per-shot clips (24fps, upscale 1280x800 → 1920x1200, crop center 1080)
CLIPS=()
for d in "$FR"/*/; do
  name="$(basename "$d")"
  ffmpeg -y -loglevel error -framerate 24 -i "$d/f%04d.jpg" \
    -vf "scale=1920:1200:flags=lanczos,crop=1920:1080" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "$OUT/$name.mp4"
  CLIPS+=("$OUT/$name.mp4")
done

# the title card: 6s from title.png (rendered by title.mjs), else a black card
if [ -f "$HERE/title.png" ]; then
  ffmpeg -y -loglevel error -loop 1 -t 6 -i "$HERE/title.png" \
    -vf "scale=1920:1200:flags=lanczos,crop=1920:1080,fade=t=in:st=0:d=1,fade=t=out:st=5:d=1" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "$OUT/99_title.mp4"
  CLIPS+=("$OUT/99_title.mp4")
fi

printf "file '%s'\n" "${CLIPS[@]}" > "$OUT/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/silent.mp4"

# score: quietest available era stem under the whole cut, faded out at the end
STEM="$(ls "$HERE/../../assets/music/"*.mp3 2>/dev/null | head -1 || true)"
if [ -n "$STEM" ]; then
  DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/silent.mp4")"
  ffmpeg -y -loglevel error -i "$OUT/silent.mp4" -stream_loop -1 -i "$STEM" \
    -filter_complex "[1:a]volume=0.35,afade=t=out:st=$(echo "$DUR - 3" | bc):d=3[a]" \
    -map 0:v -map "[a]" -t "$DUR" -c:v copy -c:a aac -b:a 160k "$OUT/master.mp4"
else
  cp "$OUT/silent.mp4" "$OUT/master.mp4"
fi
echo "master: $OUT/master.mp4"
