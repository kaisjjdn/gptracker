#!/bin/sh
# Collects Nintendo eShop prices from this Mac and writes them to the shared
# database. Run twice a day by launchd (see install.sh); safe to run by hand too.
export PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$(dirname "$0")/../.." || exit 1

echo "=== $(date '+%Y-%m-%d %H:%M:%S')"
if ! grep -q '^DATABASE_URL=..*' .env.collect 2>/dev/null; then
  echo "DATABASE_URL is missing from $(pwd)/.env.collect; nothing collected."
  exit 1
fi

# Pick up changes to the tracked games. If this fails, the current copy is used.
git pull -q --ff-only || echo "git pull failed; using the current copy"
npm install --silent --no-audit --no-fund || exit 1

# Bring the database tables up to date with the code just pulled.
node --env-file=.env.collect --import tsx src/db/migrate.ts || echo "migration failed; trying to collect anyway"

# The network may not be up yet right after the Mac wakes: try a few times.
for attempt in 1 2 3; do
  node --env-file=.env.collect --import tsx src/collectors/run.ts eshop && exit 0
  echo "attempt $attempt failed"
  [ "$attempt" -lt 3 ] && sleep 120
done
exit 1
