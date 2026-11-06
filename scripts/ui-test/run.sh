#!/bin/sh
# Eski giriş noktası: asıl betik platformdan bağımsız run.js (Node). Kullanım: scripts/ui-test/run.sh [mac|win]
exec node "$(dirname "$0")/run.js" "$@"
