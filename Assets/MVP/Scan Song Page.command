#!/bin/zsh
set -eu
script_dir="${0:A:h}"
cache_dir="${TMPDIR:-/tmp}/guitar-song-scan-swift"
mkdir -p "$cache_dir"
exec /usr/bin/swift -module-cache-path "$cache_dir" "$script_dir/ScanSongPage.swift" "$@"
