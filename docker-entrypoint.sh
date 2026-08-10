#!/bin/sh
set -e

# The uploads volume is mounted by the platform and is usually owned by root,
# so the unprivileged runtime user cannot write to it. Fix ownership as root,
# then drop privileges for the actual server process.
UPLOADS="${UPLOADS_DIR:-/app/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS"
  chown -R nextjs:nodejs "$UPLOADS" 2>/dev/null || \
    echo "[entrypoint] warning: could not chown $UPLOADS"
  exec su-exec nextjs "$@"
fi

exec "$@"
