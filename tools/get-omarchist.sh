#!/usr/bin/env bash
# Downloads the Omarchist release the checks run with, so a flow is checked
# by the same code that will run it. OMARCHIST_VERSION pins a release tag;
# the default is the latest one.
set -euo pipefail

version="${OMARCHIST_VERSION:-latest}"
releases="https://github.com/tahayvr/omarchist/releases"
if [ "$version" = latest ]; then
  url="$releases/latest/download"
else
  url="$releases/download/$version"
fi
archive=omarchist-linux-x86_64.tar.gz

curl -fsSL -o "$archive" "$url/$archive"
curl -fsSL -o "$archive.sha256" "$url/$archive.sha256"
sha256sum -c "$archive.sha256"
tar -xzf "$archive" omarchist
rm -f "$archive" "$archive.sha256"

# Omarchist is a desktop app. Its command line opens no window, but the
# binary still needs the libraries it links against.
if ! ./omarchist --version > /dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq libxkbcommon0 libxkbcommon-x11-0 libfontconfig1 libxcb1 libssl3
fi
./omarchist --version
