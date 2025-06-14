#!/bin/sh
set -eu

ROOT="/usr/share/nginx/html"
QS=""

# build query string from WSQS_ env vars
for var in $(env); do
    case "$var" in
        WSQS_*=*)
            key="${var%%=*}"
            val="${var#*=}"
            key="${key#WSQS_}"
            key="${key//_/-}"
            if [ -n "$QS" ]; then
                QS="$QS&${key}=${val}"
            else
                QS="${key}=${val}"
            fi
            ;;
    esac
done


if [ -n "$QS" ]; then
    cat > "$ROOT/redirect.html" <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Redirecting</title>
  <meta http-equiv="refresh" content="0;url=/index.html?$QS" />
</head>
<body></body>
</html>
EOF
fi

exec nginx -g 'daemon off;'
