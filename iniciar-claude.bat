@echo off
start claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions
cd ..
cd server
start node server.js