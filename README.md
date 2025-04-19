# Obsidian Timer Plugin

A simple timer plugin for Obsidian that allows you to start, pause, and stop timers using slash commands, as well as insert the current time in your notes.

## Features

- **Timer Management via Slash Commands**
  - `/Timer: start` - Start a new timer or resume a paused one
  - `/Timer: pause` - Pause the currently running timer
  - `/Timer: stop` - Stop the timer and display the total elapsed time
  
- **Time Insertion**
  - `/Timer: insert time` - Insert the current time in HH:MM AM/PM format at the cursor position

- **Status Bar Integration**
  - View the current timer status and elapsed time directly in the Obsidian status bar
  - Visual indicators for running (⏱️), paused (⏸️), and stopped states

- **Notifications**
  - Receive notifications when a timer is started, paused, or stopped

## Use Cases

- **Pomodoro Technique** - Start a 25-minute timer for focused work sessions
- **Meeting Notes** - Track how long meetings run by starting a timer at the beginning
- **Time Tracking** - Keep track of how long you spend on specific tasks or projects
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
4. Restart Obsidian
5. Enable the plugin in Settings → Community plugins

## Usage

1. **Starting a Timer**
   - In any note, type `/Timer: start`
   - A notification will appear indicating the timer has started
   - The timer status and elapsed time will appear in the status bar

2. **Pausing a Timer**
   - Type `/Timer: pause` to pause the current timer
   - The elapsed time will be preserved

3. **Stopping a Timer**
   - Type `/Timer: stop` to stop the current timer
   - A notification will display the total elapsed time

4. **Inserting the Current Time**
   - Place your cursor where you want to insert the time
   - Type `/Timer: insert time`
   - The current time will be inserted in HH:MM AM/PM format

## Planned Features

- [ ] Customizable time formats
- [ ] Timer presets (e.g., 5 min, 25 min, 50 min)
- [ ] Timer history
- [ ] Sound notifications
- [ ] Timer labels

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
4. Copy `main.js` and `manifest.json` to your vault's `.obsidian/plugins/obsidian-timer-plugin/` directory

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Author

Created by [Kavir Kaycee](https://github.com/kavir10)

## Acknowledgments

- Obsidian team for creating an amazing knowledge management tool
- Obsidian Plugin Developer community for their valuable resources