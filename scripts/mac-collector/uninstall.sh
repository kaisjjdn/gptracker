#!/bin/sh
# Stops the daily Nintendo eShop collection on this Mac. The copy of the
# project in ~/gptracker-collector is left in place; delete it yourself if you
# no longer need it (it holds the database connection string in .env.collect).
LABEL="com.gptracker.collect-eshop"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Removed the daily job. Left in place: $HOME/gptracker-collector"
