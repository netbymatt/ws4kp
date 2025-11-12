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
    # Skip empty lines
    [ -z "$key" ] && continue

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
$(env | grep '^WSQS_' || true)
EOF

mkdir -p /etc/nginx/includes

if [ -n "$QS" ]; then
    # Escape the query string for use in JavaScript (escape backslashes and single quotes)
    QS_ESCAPED=$(printf '%s' "$QS" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\'/g")

    # Generate redirect.html with JavaScript logic
    cat > "$ROOT/redirect.html" <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Redirecting</title>
  <meta http-equiv="refresh" content="0;url=/index.html?$QS" />
  <script>
    (function() {
      var wsqsParams = '$QS_ESCAPED';
      var currentParams = window.location.search.substring(1);
      var targetParams = currentParams || wsqsParams;
      window.location.replace('/index.html?' + targetParams);
    })();
  </script>
</head>
<body></body>
</html>
EOF

    # Generate nginx config for conditional redirects
    cat > /etc/nginx/includes/wsqs_redirect.conf <<'EOF'
location = / {
    if ($args = '') {
        rewrite ^ /redirect.html last;
    }
    rewrite ^/$ /index.html?$args? redirect;
}

location = /index.html {
    if ($args = '') {
        rewrite ^ /redirect.html last;
    }
}
EOF
else
    touch /etc/nginx/includes/wsqs_redirect.conf
fi

exec nginx -g 'daemon off;'
