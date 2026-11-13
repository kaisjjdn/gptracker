#!/bin/sh
# Sets this Mac up to collect Nintendo eShop prices every day.
#
# It keeps its own copy of the project in ~/gptracker-collector (so it does not
# depend on where you edit the code) and registers a launchd job for your user.
# Run it again any time; it only updates what is there. Undo with uninstall.sh.
set -e
export PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

DEST="$HOME/gptracker-collector"
LABEL="com.gptracker.collect-eshop"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/gptracker-collect-eshop.log"
SOURCE="$(cd "$(dirname "$0")/../.." && pwd)"

command -v node >/dev/null || { echo "Node.js was not found."; exit 1; }

if [ ! -d "$DEST/.git" ]; then
  git clone "$(git -C "$SOURCE" remote get-url origin)" "$DEST"
fi
cd "$DEST"
git pull -q --ff-only
npm ci --no-audit --no-fund

if ! grep -q '^DATABASE_URL=..*' .env.collect 2>/dev/null; then
  [ -f .env.collect ] || printf 'DATABASE_URL=\n' > .env.collect
  chmod 600 .env.collect
  echo
  echo "Paste the Supabase connection string after DATABASE_URL= in the file that"
  echo "just opened, save it, then run this script again:"
  echo "  $DEST/.env.collect"
  open -e .env.collect
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST_END
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$DEST/scripts/mac-collector/collect-eshop.sh</string>
  </array>
  <!-- 00:40 every day. If the Mac is asleep then, it runs when it wakes. -->
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>40</integer></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_END

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo
echo "Installed. Nintendo eShop prices are collected daily at 00:40."
echo "Run it now:  launchctl kickstart gui/$(id -u)/$LABEL"
echo "See the log: cat $LOG"
