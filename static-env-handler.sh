#!/bin/sh
set -eu

ROOT="/usr/share/nginx/html"
QS=""

# URL encode a string
url_encode() {
    local string="$1"
    printf '%s' "$string" | sed 's/ /%20/g; s/"/%22/g; s/</%3C/g; s/>/%3E/g; s/&/%26/g; s/#/%23/g; s/+/%2B/g'
}

# build query string from WSQS_ env vars
while IFS='=' read -r key val; do
    # Remove WSQS_ prefix and convert underscores to hyphens
    key="${key#WSQS_}"
    key="${key//_/-}"
    # URL encode the value
    encoded_val=$(url_encode "$val")
    if [ -n "$QS" ]; then
        QS="$QS&${key}=${encoded_val}"
    else
        QS="${key}=${encoded_val}"
    fi
done << EOF
$(env | grep '^WSQS_')
EOF


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
