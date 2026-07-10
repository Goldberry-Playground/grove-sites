#!/usr/bin/env bash
# Rootless resolver: extract Debian libs a binary needs into a prefix, via iterative ldd closure.
# Matches ONLY canonical multiarch path usr/lib/x86_64-linux-gnu/<soname> to avoid bundled/32-bit/test dupes.
# Usage: resolve-libs.sh <binary> <prefix-root>
set -uo pipefail
BIN="$1"; ROOT="$2"
IDX="$ROOT/idx"; DEBS="$ROOT/debs"; LIBS="$ROOT/libs"
mkdir -p "$DEBS" "$LIBS"
DEB_BASE="https://deb.debian.org/debian"
libdirs() { echo "$LIBS/usr/lib/x86_64-linux-gnu:$LIBS/lib/x86_64-linux-gnu"; }

pkg_deb_url() { awk -v p="$1" '$1=="Package:"{c=$2} $1=="Filename:"&&c==p{print $2;exit}' "$IDX/Packages"; }

install_pkg() {
  local pkg="$1"
  [ -f "$DEBS/.done-$pkg" ] && return 0
  local fn; fn=$(pkg_deb_url "$pkg")
  [ -z "$fn" ] && { echo "  ! no deb: $pkg"; return 1; }
  local out="$DEBS/$(basename "$fn")"
  curl -sS "$DEB_BASE/$fn" -o "$out" && dpkg -x "$out" "$LIBS" && touch "$DEBS/.done-$pkg" && echo "  + $pkg" || echo "  ! failed $pkg"
}

for iter in $(seq 1 12); do
  export LD_LIBRARY_PATH="$(libdirs)"
  missing=$(ldd "$BIN" 2>/dev/null | awk '/not found/{print $1}' | sort -u)
  [ -z "$missing" ] && { echo "== closure complete (iter $iter) =="; break; }
  echo "== iter $iter: $(echo "$missing"|wc -l) missing: $(echo $missing) =="
  # single Contents pass: for canonical multiarch path == /<soname>, print pkgname
  pkgs=$(awk -v want="|$(echo $missing|tr ' ' '|')|" '
    { p=$1
      if (p ~ /^(usr\/)?lib\/x86_64-linux-gnu\//) {
        n=split(p,a,"/"); base=a[n]
        if (index(want,"|" base "|")>0) { split($NF,s,"/"); print s[length(s)] }
      } }' "$IDX/Contents" | sort -u)
  [ -z "$pkgs" ] && { echo "  ? none resolved this iter"; break; }
  for pkg in $pkgs; do install_pkg "$pkg"; done
done
export LD_LIBRARY_PATH="$(libdirs)"
echo "== final unresolved =="; ldd "$BIN" 2>/dev/null | awk '/not found/{print "  "$1}'|sort -u
