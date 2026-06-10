#!/usr/bin/env bash
# Assemble the theDAW showcase from the warm-session clips, with burned-in subtitles,
# scored to "et tu machina_.mp3". Horizontal (16:9) and vertical (9:16, punch-in crops).
#   bash showcase/build_roughcut.sh h     (or v)
# Run from repo root. Clips are silent; the song is the only audio.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DIR="showcase/clips-recorded"
SONG="et tu machina_.mp3"
ORI="${1:-h}"
FONT="showcase/.font.ttf"
[ -f "$FONT" ] || cp /c/Windows/Fonts/segoeuib.ttf "$FONT"

# Per scene: id | seconds | h-crop | v-crop | start | subtitle
#   h-crop "full" or CW:CH:CX:CY ; v-crop is the 9:16 punch-in region ; start "" = clean tail.
# Order: a rapid-fire opening blast, then the full feature tour. Subtitles are lower-case
# and plain on purpose.
# A "song being made in theDAW" arc, built around Et Tu Machina: hook -> make -> arrange ->
# mix -> perform -> visualize -> lineage -> ecosystem. Order is the narrative; durations flex.
SCENES=(
  # hook + lineage
  "50_cymatics|5.0|1680:945:120:70|608:1080:656:0|0.5|one machine, every instrument"
  "01a_learn-2d-hero|1.9|full|608:1080:656:0|19.0|every track remembers its lineage"
  # make the song
  "08_make|1.4|full|608:1080:656:0||generate from a prompt"
  "23_chimera|1.6|full|608:1080:656:0||fuse clips into a chimera"
  "25_init-audio|1.4|full|608:1080:656:0||seed it with your own audio"
  "21_inpaint|1.4|full|608:1080:656:0||repaint any section"
  "45_saved-prompts|1.2|full|608:1080:656:0||save every prompt"
  "05_sequencer|1.3|full|608:1080:656:0||a step sequencer"
  "58_spectrogram|1.9|full|608:1080:656:0||mel · stft · chroma · cqt"
  # arrange + edit
  "03_edit-stems|1.9|full|608:1080:656:0||arrange the stems on a timeline"
  "22_cut-edit|1.5|full|608:1080:656:0||cut and chop the clips"
  "41_delete-clip|1.3|full|608:1080:656:0||edit like a daw"
  "31_edit-mix|1.4|full|608:1080:656:0||mix the tracks live"
  "40_inpaint-region|1.4|full|608:1080:656:0||paintbrush inpainting"
  "59_commit-edit|1.5|full|608:1080:656:0||commit to a 44.1khz master"
  # mix
  "07_mix-effects|1.4|full|608:1080:1312:0||a studio effects rack"
  "57_mix-all-effects|2.0|full|608:1080:400:0||every effect, on the track"
  "66_module-gui|1.7|full|608:1080:1312:0||14 pro-grade instruments"
  "32_mix-chain|1.4|full|608:1080:400:0||stack a mastering chain"
  "27_lora|1.3|full|608:1080:1312:0||load loras"
  "39_design-mode|1.6|full|608:1080:656:0||rearrange the interface"
  # perform (dj)
  "02_dj-console|1.5|full|540:960:690:90||a two-deck dj console"
  "54_dj-perform|2.0|full|540:960:690:90||hotcues, loops, and fx"
  "55_dj-automix|1.5|full|540:960:690:90||automix, hands-free"
  "56_dj-stems|1.4|full|540:960:690:90||live stems on the deck"
  "33_dj-sampler|1.4|full|608:1080:300:0||sampler + staging deck"
  # visualize
  "50_cymatics|5.0|1680:945:120:70|608:1080:656:0|6.8|cymatic platform"
  "50_cymatics|5.0|1680:945:120:70|608:1080:656:0|12.5|liquid-chrome cymatics"
  "50_cymatics|5.0|1680:945:120:70|608:1080:656:0|18.5|ferrofluid valley"
  "12_slide-surface|1.5|full|608:1080:500:0||performance sliders"
  "19_vj-visualizer|3.5|full|608:1080:750:0||drive live visuals"
  "70_vj-mobile|1.6|full|608:1080:1312:0||mirror to a phone over wi-fi"
  "04_visualize|1.2|full|608:1080:656:0||live spectrum"
  "15_analyzer-scope|1.2|full|608:1080:656:0||oscilloscope"
  "16_analyzer-radial|1.3|full|540:960:830:120||radial analyzer"
  # lineage + library + ecosystem
  "65_3d-piano|6.5|full|608:1080:656:0|1.5|fly the lineage into the keys"
  "48_galaxy-preset|1.3|full|608:1080:656:0||constellation view"
  "14_catalogue|1.5|full|608:1080:300:0||your whole library"
  "13_details|1.3|full|608:1080:300:0||full metadata on everything"
  "24_focus|1.4|full|608:1080:656:0||focus on one control"
  "17_controller|1.4|full|608:1080:656:0||map any midi controller"
  "69_controller-vision|1.7|full|608:1080:656:0||identify a controller from a photo"
  "20_train|1.7|full|608:1080:656:0||train it on your own sound"
  "63_magenta-studio-live|1.8|full|608:1080:656:0||magenta rt2, on the local gpu"
  "62_magenta-card|2.0|full|600:1080:540:0||the first non-mac magenta rt2 port"
  "10_suno-cloud|1.4|full|608:1080:560:0||or render in the cloud"
  "44_url-import|1.3|full|608:1080:120:0||pull audio from a link"
  "18_media-bucket|1.2|full|608:1080:120:0||drop in any file"
  "11_assistant-orb|1.6|full|608:1080:0:0||an assistant that runs the app"
  "37_docs|1.5|full|608:1080:656:0||documented from the inside"
  "38_settings|1.6|full|608:1080:656:0||modular, all of it"
  "36_log|1.2|full|608:1080:1312:0||watch every job run"
)

# Subtitles: bigger + raised off the bottom. Vertical sits higher (above the lower-third).
if [ "$ORI" = "v" ]; then W=1080; H=1920; SUBY="h-470"; SUBSZ=58; else W=1920; H=1080; SUBY="h-128"; SUBSZ=46; fi

TMP="showcase/.roughtmp_${ORI}"
rm -rf "$TMP"; mkdir -p "$TMP"
CLIST="$TMP/clist.txt"; : > "$CLIST"   # clean segments
SLIST="$TMP/slist.txt"; : > "$SLIST"   # subtitled segments
SRT="$DIR/_showcase_${ORI}.srt"; : > "$SRT"

# Crop coords in SCENES are authored in 1920x1080 space. Clips can be shot at different widths
# across runs, so scale each clip's crop by ITS OWN source width / 1920.
scale_crop() { echo "$1" | awk -F: -v s="$2" '{printf "%d:%d:%d:%d", 2*int($1*s/2+0.5), 2*int($2*s/2+0.5), int($3*s+0.5), int($4*s+0.5)}'; }
srt_ts() { awk -v t="$1" 'BEGIN{h=int(t/3600); m=int((t-h*3600)/60); s=t-h*3600-m*60; printf "%02d:%02d:%06.3f", h, m, s}' | sed 's/\./,/'; }

i=0; cum=0
for row in "${SCENES[@]}"; do
  IFS='|' read -r id dur hcrop vcrop start sub <<< "$row"
  f="$DIR/${id}_h.mp4"; [ -f "$f" ] || f="$DIR/${id}_h.webm"
  if [ ! -f "$f" ]; then echo "skip (missing) ${id}"; continue; fi

  if [ "$ORI" = "v" ]; then crop="$vcrop"; elif [ "$hcrop" = "full" ]; then crop=""; else crop="$hcrop"; fi
  if [ -n "$crop" ]; then cw="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nk=1:nw=1 "$f")"; sf="$(awk -v w="${cw:-1920}" 'BEGIN{printf "%.5f", w/1920}')"; crop="$(scale_crop "$crop" "$sf")"; geom="crop=${crop},scale=${W}:${H}:flags=lanczos"; else geom="scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}"; fi

  clip_dur="$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$f")"
  if [ -z "$start" ]; then start="$(python -c "print(max(0.0, ${clip_dur} - ${dur} - 0.3))")"; fi

  subfile="$TMP/sub_$(printf '%02d' "$i").txt"; printf '%s' "$sub" > "$subfile"
  draw="drawtext=fontfile=${FONT}:textfile=${subfile}:x=(w-text_w)/2:y=${SUBY}:fontsize=${SUBSZ}:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=16:line_spacing=6"
  cseg="$(printf 'cseg_%02d.mp4' "$i")"; sseg="$(printf 'sseg_%02d.mp4' "$i")"
  # ONE high-quality encode each (clean + subtitled) — no second re-encode pass.
  ffmpeg -y -loglevel error -ss "$start" -t "$dur" -i "$f" -an -vf "${geom},fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p "$TMP/$cseg"
  ffmpeg -y -loglevel error -ss "$start" -t "$dur" -i "$f" -an -vf "${geom},${draw},fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p "$TMP/$sseg"
  printf "file '%s'\n" "$cseg" >> "$CLIST"
  printf "file '%s'\n" "$sseg" >> "$SLIST"

  st="$cum"; en="$(awk -v a="$cum" -v b="$dur" 'BEGIN{printf "%.3f", a+b}')"
  printf '%d\n%s --> %s\n%s\n\n' "$((i + 1))" "$(srt_ts "$st")" "$(srt_ts "$en")" "$sub" >> "$SRT"
  cum="$en"
  echo "  + ${id} (${dur}s) — ${sub}"
  i=$((i + 1))
done

# concat (stream copy — NO extra generation) then mux the song (copy)
CLEAN_SILENT="$TMP/clean.mp4"; ffmpeg -y -loglevel error -f concat -safe 0 -i "$CLIST" -c copy "$CLEAN_SILENT"
SUB_SILENT="$TMP/subbed.mp4";  ffmpeg -y -loglevel error -f concat -safe 0 -i "$SLIST" -c copy "$SUB_SILENT"
VLEN="$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$CLEAN_SILENT")"

CLEAN_OUT="$DIR/_showcase_${ORI}_clean.mp4"
ffmpeg -y -loglevel error -i "$CLEAN_SILENT" -i "$SONG" -map 0:v -map 1:a -t "$VLEN" -c:v copy -c:a aac -b:a 256k -shortest "$CLEAN_OUT"
OUT="$DIR/_showcase_${ORI}.mp4"
ffmpeg -y -loglevel error -i "$SUB_SILENT" -i "$SONG" -map 0:v -map 1:a -t "$VLEN" -c:v copy -c:a aac -b:a 256k -shortest "$OUT"
rm -rf "$TMP"
echo "wrote $OUT + $CLEAN_OUT + $SRT  (${VLEN}s, ${W}x${H})"
