# Obsidian Timer Plugin

A simple timer plugin for Obsidian with slash commands for start, pause, stop, and inserting current time.

## Features

- Start a timer via slash command (`/Timer: start`)
- Pause a timer via slash command (`/Timer: pause`)
- Stop a timer via slash command (`/Timer: stop`)
- Insert current time in HH:MM AM/PM format via slash command
- Timer status displayed in the status bar

## Installation

### For development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Copy `main.js` and `manifest.json` to your Obsidian vault's `.obsidian/plugins/obsidian-timer-plugin/` directory

### For use in Obsidian

1. Create a folder named `obsidian-timer-plugin` in your Obsidian vault's `.obsidian/plugins/` directory
2. Copy `main.js` and `manifest.json` to this folder
3. Restart Obsidian
4. Go to Settings → Community plugins
5. Enable the "Timer Plugin"

## Usage

- Start a timer: Use `/Timer: start` slash command
- Pause a timer: Use `/Timer: pause` slash command
- Stop a timer: Use `/Timer: stop` slash command
- Insert current time: Use `/Timer: insert time` slash command

The timer status will be displayed in the status bar at the bottom of the Obsidian window.