# Obsidian Timer Plugin

A simple timer plugin for Obsidian that lets you start, pause, and stop timers from the command palette or the status bar, log time entries to a tracker note, and insert the current time into your notes.

## Features

- **Timer commands** (via the command palette or hotkeys)
  - `Start timer` - Start a new timer or resume a paused one
  - `Pause timer` - Pause the currently running timer
  - `Stop timer` - Stop the timer, log a time entry, and show the total elapsed time
  - `Insert current time` - Insert the current time in HH:MM AM/PM format at the cursor position

- **Clickable status bar**
  - View the current timer status and elapsed time directly in the Obsidian status bar
  - Click to start, resume, or stop the timer
  - Visual indicators for running (⏱️), paused (⏸️), and ready states

- **Time tracking**
  - Every stopped timer is logged to a tracker note (default: `Time Tracker.md`, newest entries on top)
  - Entries capture the date, day of week, and duration
  - Optionally captures the line under your cursor as the task, including `[[project]]` links and `#tags`

- **Sound notification**
  - Optionally play a sound when the timer stops (customizable sound file)

- **Notifications**
  - Receive notifications when a timer is started, paused, resumed, or stopped

## Use Cases

- **Pomodoro Technique** - Start a timer for focused work sessions
- **Meeting Notes** - Track how long meetings run by starting a timer at the beginning
- **Time Tracking** - Keep a running log of how long you spend on specific tasks or projects
- **Time Stamps** - Quickly insert the current time into your notes

## Installation

### From Community Plugins (Coming Soon)
1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode if it's enabled
3. Click Browse and search for "Timer Plugin"
4. Install and enable the plugin

### Manual Installation (Direct from GitHub)
1. Download the latest release from the [releases page](https://github.com/kavir10/obsidian-timer-plugin/releases)
2. Extract the downloaded zip into your vault's `.obsidian/plugins/` folder
3. Make sure you have the following files in `.obsidian/plugins/obsidian-timer-plugin/`:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Restart Obsidian
5. Enable the plugin in Settings → Community plugins

## Usage

1. **Starting a timer**
   - Run `Start timer` from the command palette, or click the timer in the status bar
   - The timer status and elapsed time appear in the status bar

2. **Pausing a timer**
   - Run `Pause timer` to pause the current timer; the elapsed time is preserved
   - Click the status bar (or run `Start timer`) to resume

3. **Stopping a timer**
   - Run `Stop timer` or click the running timer in the status bar
   - A time entry is added to your tracker note, and the elapsed time can optionally be inserted at the cursor

4. **Inserting the current time**
   - Place your cursor where you want to insert the time and run `Insert current time`

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| Play sound | Play a sound when the timer stops | On |
| Sound file | Path to the sound file, relative to the plugin folder | `timer_stop.mp3` |
| Time tracker file | Vault path of the note where time entries are logged | `Time Tracker.md` |
| Capture task from active note | Include the line under the cursor (task text, `[[projects]]` and `#tags`) in each time entry | On |
| Insert duration on stop | Insert the elapsed time at the cursor position when the timer stops | On |

## Planned Features

- [ ] Customizable time formats
- [ ] Timer presets (e.g., 5 min, 25 min, 50 min)
- [ ] Timer labels
- [ ] Persist a running timer across app restarts

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

If you want to contribute to the plugin or customize it for your own use:

1. Clone this repository
2. Install dependencies with `npm install`
3. Build the plugin with `npm run build`
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/obsidian-timer-plugin/` directory

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Author

Created by [Kavir Kaycee](https://github.com/kavir10)

## Acknowledgments

- Obsidian team for creating an amazing knowledge management tool
- Obsidian Plugin Developer community for their valuable resources
