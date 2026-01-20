#!/usr/bin/env bash

set -e

echo "========================================="
echo "  Wails 2.11 + WebKitGTK4 Installer"
echo "  for Debian 13 (Trixie)"
echo "========================================="

# -------------------------------------------------
# Check Go installation
# -------------------------------------------------
if ! command -v go >/dev/null 2>&1; then
    echo "❌ Fehler: Go ist nicht installiert!"
    echo "Installiere Go und starte das Skript erneut."
    exit 1
fi

# -------------------------------------------------
# Installiere Debian 12 WebKitGTK 4.0 Pakete
# -------------------------------------------------
echo "→ Lade WebKitGTK 4.0 Pakete aus Debian 12 herunter..."

wget -q http://deb.debian.org/debian/pool/main/w/webkit2gtk/libwebkit2gtk-4.0-37_2.48.5-1~deb12u1_amd64.deb
wget -q http://deb.debian.org/debian/pool/main/w/webkit2gtk/libwebkit2gtk-4.0-dev_2.48.5-1~deb12u1_amd64.deb

echo "→ Installiere WebKitGTK 4.0 (Bookworm-Version)..."

sudo apt install -y ./libwebkit2gtk-4.0-37_2.48.5-1~deb12u1_amd64.deb
sudo apt install -y ./libwebkit2gtk-4.0-dev_2.48.5-1~deb12u1_amd64.deb

echo "✔ WebKitGTK 4.0 erfolgreich installiert!"

# -------------------------------------------------
# Installiere Wails 2.11
# -------------------------------------------------
echo "→ Installiere Wails 2.11 via Go..."

go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0

# -------------------------------------------------
# Wails global verlinken
# -------------------------------------------------
if [ -f "$HOME/go/bin/wails" ]; then
    echo "→ Verlinke Wails nach /usr/local/bin..."
    sudo ln -sf "$HOME/go/bin/wails" /usr/local/bin/wails
else
    echo "❌ Fehler: ~/go/bin/wails wurde nicht gefunden!"
    exit 1
fi

echo "✔ Wails erfolgreich installiert!"

# -------------------------------------------------
# Cleanup
# -------------------------------------------------
rm -f libwebkit2gtk-4.0-37_*.deb
rm -f libwebkit2gtk-4.0-dev_*.deb

echo
echo "========================================="
echo " Installation abgeschlossen!"
echo "========================================="
echo
echo "→ Prüfe Installation mit:"
echo "   wails version"
echo "   wails doctor"
echo
echo "Falls du ein neues Projekt erstellen willst:"
echo "   wails init -n meinprojekt"
