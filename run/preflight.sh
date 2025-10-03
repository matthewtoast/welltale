#!/bin/bash
# Suppress AWS SDK warnings about multiple credential sources
# If AWS_PROFILE is set along with AWS_ACCESS_KEY_ID, unset the profile
if [ -n "$AWS_PROFILE" ] && [ -n "$AWS_ACCESS_KEY_ID" ]; then
  unset AWS_PROFILE
fi

# Also suppress any maintenance mode messages
export AWS_SDK_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1

exec "$@"