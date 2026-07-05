import { App, Plugin, Editor, MarkdownView, Notice, PluginSettingTab, Setting, TFile, normalizePath } from 'obsidian';

interface TimerPluginSettings {
    playSound: boolean;
    customSoundPath: string;
    timeTrackerFilePath: string;
    captureActiveFile: boolean;
    insertDurationOnStop: boolean;
}

const DEFAULT_SETTINGS: TimerPluginSettings = {
    playSound: true,
    customSoundPath: 'timer_stop.mp3',
    timeTrackerFilePath: 'Time Tracker.md',
    captureActiveFile: true,
    insertDurationOnStop: true
}

const TIME_TRACKER_HEADER = 'Time entries tracked by Obsidian Timer Plugin';

// Define the TimeEntry interface
interface TimeEntry {
    date: string;           // YYYY-MM-DD
    dayOfWeek: string;      // Monday, Tuesday, etc.
    duration: string;       // Formatted duration
    taskDetails?: string;   // Text from line where cursor is
    projects?: string[];    // Array of [[page references]]
    tags?: string[];        // Array of #tags
}

export default class TimerPlugin extends Plugin {
    settings: TimerPluginSettings;
    private timerStatus: 'stopped' | 'running' | 'paused' = 'stopped';
    private startTime: number = 0;
    private elapsedTime: number = 0;
    private timerInterval: number | null = null;
    private statusBarItem: HTMLElement | null = null;
    private lastActiveEditor: Editor | null = null;

    // Helper functions for time entries
    private extractProjects(text: string): string[] {
        const projectRegex = /\[\[(.*?)\]\]/g;
        const projects: string[] = [];
        let match;
        while ((match = projectRegex.exec(text)) !== null) {
            projects.push(match[0]);
        }
        return projects;
    }

    private extractTags(text: string): string[] {
        // Match Obsidian-style tags (letters, digits, _, -, /) so trailing
        // punctuation like "#work," doesn't end up in the tag
        const tagRegex = /#[\w/-]+/g;
        return text.match(tagRegex) ?? [];
    }

    private getCurrentDate(): string {
        // Format the local date; toISOString() would return the UTC date,
        // which is off by one after midnight UTC
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private getDayOfWeek(): string {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Time Tracker file management
    private async ensureTimeTrackerFile(): Promise<TFile | null> {
        const filePath = normalizePath(this.settings.timeTrackerFilePath);
        try {
            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing instanceof TFile) {
                return existing;
            }
            if (existing) {
                new Notice(`Time tracker path points to a folder: ${filePath}`);
                return null;
            }
            return await this.app.vault.create(filePath, `${TIME_TRACKER_HEADER}\n\n`);
        } catch (error) {
            console.error('Failed to ensure Time Tracker file:', error);
            new Notice('Failed to create or access Time Tracker file');
            return null;
        }
    }

    private formatTimeEntry(entry: TimeEntry): string {
        // Start with date and day
        let formattedEntry = `- Date: ${entry.date} | Day: ${entry.dayOfWeek} | Duration: ${entry.duration}`;

        // Add task details if available, but remove project references and tags
        if (entry.taskDetails) {
            let cleanTaskDetails = entry.taskDetails;
            // Remove project references
            cleanTaskDetails = cleanTaskDetails.replace(/\[\[.*?\]\]/g, '');
            // Remove tags
            cleanTaskDetails = cleanTaskDetails.replace(/#[\w/-]+/g, '');
            // Clean up any extra spaces and trim
            cleanTaskDetails = cleanTaskDetails.replace(/\s+/g, ' ').trim();

            if (cleanTaskDetails) {
                formattedEntry += ` | Task: ${cleanTaskDetails}`;
            }
        }

        // Add projects if available
        if (entry.projects && entry.projects.length > 0) {
            formattedEntry += ` | Project: ${entry.projects.join(', ')}`;
        }

        // Add tags if available
        if (entry.tags && entry.tags.length > 0) {
            formattedEntry += ` | Tags: ${entry.tags.join(', ')}`;
        }

        return formattedEntry;
    }

    private async addTimeEntry(entry: TimeEntry): Promise<boolean> {
        try {
            const file = await this.ensureTimeTrackerFile();
            if (!file) return false;

            const formattedEntry = this.formatTimeEntry(entry);

            // vault.process applies the change atomically and keeps
            // Obsidian's cache (and any open editors) in sync
            await this.app.vault.process(file, (contents) => {
                const lines = contents.split('\n');

                // Newest entries go on top: insert before the first existing
                // entry, or after the header block if there are none yet
                let insertPosition = lines.findIndex(line => line.startsWith('- Date:'));
                if (insertPosition === -1) {
                    const lastNonEmpty = lines.reduce(
                        (last, line, i) => line.trim() ? i : last, -1);
                    insertPosition = lastNonEmpty + 1;
                }

                lines.splice(insertPosition, 0, formattedEntry);
                return lines.join('\n');
            });

            new Notice(`Time entry added to ${file.path}`);
            return true;
        } catch (error) {
            console.error('Failed to add time entry:', error);
            new Notice('Failed to add time entry to Time Tracker file');
            return false;
        }
    }

    async onload() {
        await this.loadSettings();

        // Track last active editor
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf?.view instanceof MarkdownView) {
                    this.lastActiveEditor = leaf.view.editor;
                }
            })
        );

        // Create status bar item
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass('timer-status-bar-item');

        // Add click handler
        this.statusBarItem.onClickEvent((evt: MouseEvent) => {
            evt.preventDefault();
            if (this.timerStatus === 'running') {
                this.stopTimer();
            } else {
                this.startTimer();
            }
        });

        // Add hover state
        this.statusBarItem.title = 'Click to start/stop timer';
        this.updateStatusBar();

        // Add settings tab
        this.addSettingTab(new TimerSettingTab(this.app, this));

        // Obsidian prefixes command names with the plugin name in the
        // palette; IDs stay unchanged so existing hotkeys keep working
        this.addCommand({
            id: 'start-timer',
            name: 'Start timer',
            callback: () => {
                this.startTimer();
            }
        });

        this.addCommand({
            id: 'stop-timer',
            name: 'Stop timer',
            callback: () => {
                this.stopTimer();
            }
        });

        this.addCommand({
            id: 'pause-timer',
            name: 'Pause timer',
            callback: () => {
                this.pauseTimer();
            }
        });

        this.addCommand({
            id: 'insert-current-time',
            name: 'Insert current time',
            editorCallback: (editor: Editor) => {
                this.insertCurrentTime(editor);
            }
        });
    }

    onunload() {
        this.clearTimerInterval();
    }

    private clearTimerInterval() {
        if (this.timerInterval !== null) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    private startTimer() {
        if (this.timerStatus === 'running') {
            new Notice('Timer is already running.');
            return;
        }

        const resuming = this.timerStatus === 'paused';
        if (resuming) {
            // Resume the timer
            this.startTime = Date.now() - this.elapsedTime;
        } else {
            // Start a new timer
            this.startTime = Date.now();
            this.elapsedTime = 0;
        }

        this.timerStatus = 'running';

        // Update status bar every second
        this.timerInterval = this.registerInterval(window.setInterval(() => {
            this.updateStatusBar();
        }, 1000));

        this.updateStatusBar();
        new Notice(resuming ? 'Timer resumed.' : 'Timer started.');
    }

    private pauseTimer() {
        if (this.timerStatus !== 'running') {
            new Notice('Timer is not running.');
            return;
        }

        this.elapsedTime = Date.now() - this.startTime;
        this.timerStatus = 'paused';
        this.clearTimerInterval();

        this.updateStatusBar();
        new Notice('Timer paused. Elapsed time: ' + this.formatElapsedTime(this.elapsedTime));
    }

    private async playTimerSound() {
        if (!this.settings.playSound) return;

        try {
            const pluginDir = this.manifest.dir;
            if (!pluginDir) return;

            const soundPath = normalizePath(`${pluginDir}/${this.settings.customSoundPath}`);
            if (!(await this.app.vault.adapter.exists(soundPath))) {
                new Notice(`Timer sound file not found: ${this.settings.customSoundPath}`);
                return;
            }

            // getResourcePath returns an app:// URL that works on both
            // desktop and mobile (file:// URLs are blocked by Obsidian)
            const audio = new Audio(this.app.vault.adapter.getResourcePath(soundPath));
            await audio.play();
        } catch (error) {
            console.error('Failed to play timer sound:', error);
            new Notice('Failed to play timer sound. Please check your sound settings.');
        }
    }

    private async stopTimer() {
        if (this.timerStatus === 'stopped') {
            new Notice('Timer is not running.');
            return;
        }

        const elapsedTime = this.timerStatus === 'running'
            ? Date.now() - this.startTime
            : this.elapsedTime;

        this.timerStatus = 'stopped';
        this.elapsedTime = 0;
        this.clearTimerInterval();

        // Play sound if enabled
        await this.playTimerSound();

        // Format elapsed time
        const formattedTime = this.formatElapsedTime(elapsedTime);

        // Create time entry
        const timeEntry: TimeEntry = {
            date: this.getCurrentDate(),
            dayOfWeek: this.getDayOfWeek(),
            duration: formattedTime,
        };

        // Get task details from current file if available
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && this.settings.captureActiveFile) {
            const editor = view.editor;
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);

            if (line && line.trim()) {
                timeEntry.taskDetails = line.trim();
                timeEntry.projects = this.extractProjects(line);
                timeEntry.tags = this.extractTags(line);
            }
        }

        // Add entry to Time Tracker file
        await this.addTimeEntry(timeEntry);

        // Insert elapsed time at cursor (using last active editor if available)
        if (this.settings.insertDurationOnStop) {
            const editor = view?.editor || this.lastActiveEditor;
            if (editor) {
                try {
                    editor.replaceSelection(formattedTime);
                } catch (error) {
                    // The last active editor may belong to a closed pane
                    console.error('Failed to insert elapsed time:', error);
                }
            }
        }

        this.updateStatusBar();
        new Notice('Timer stopped. Total time: ' + formattedTime);
    }

    private insertCurrentTime(editor: Editor) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

        const timeString = `${formattedHours}:${formattedMinutes} ${ampm}`;
        editor.replaceSelection(timeString);
    }

    private formatElapsedTime(milliseconds: number): string {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    }

    private updateStatusBar() {
        if (!this.statusBarItem) return;

        // Remove all state classes first
        this.statusBarItem.removeClass('timer-running');
        this.statusBarItem.removeClass('timer-ready');

        switch (this.timerStatus) {
            case 'running': {
                const currentElapsedTime = Date.now() - this.startTime;
                this.statusBarItem.setText(`⏱️ ${this.formatElapsedTime(currentElapsedTime)}`);
                this.statusBarItem.addClass('timer-running');
                this.statusBarItem.title = 'Click to stop timer';
                break;
            }
            case 'paused':
                this.statusBarItem.setText(`⏸️ ${this.formatElapsedTime(this.elapsedTime)}`);
                this.statusBarItem.addClass('timer-ready');
                this.statusBarItem.title = 'Click to resume timer';
                break;
            case 'stopped':
                this.statusBarItem.setText('⏱️ Timer ready');
                this.statusBarItem.addClass('timer-ready');
                this.statusBarItem.title = 'Click to start timer';
                break;
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class TimerSettingTab extends PluginSettingTab {
    plugin: TimerPlugin;

    constructor(app: App, plugin: TimerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Play sound')
            .setDesc('Play a sound when the timer stops')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.playSound)
                .onChange(async (value) => {
                    this.plugin.settings.playSound = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sound file')
            .setDesc('Path to the sound file, relative to the plugin folder')
            .addText(text => text
                .setPlaceholder('timer_stop.mp3')
                .setValue(this.plugin.settings.customSoundPath)
                .onChange(async (value) => {
                    this.plugin.settings.customSoundPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Time tracker file')
            .setDesc('Vault path of the note where time entries are logged')
            .addText(text => text
                .setPlaceholder('Time Tracker.md')
                .setValue(this.plugin.settings.timeTrackerFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.timeTrackerFilePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Capture task from active note')
            .setDesc('Include the line under the cursor (task text, [[projects]] and #tags) in each time entry')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.captureActiveFile)
                .onChange(async (value) => {
                    this.plugin.settings.captureActiveFile = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Insert duration on stop')
            .setDesc('Insert the elapsed time at the cursor position when the timer stops')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.insertDurationOnStop)
                .onChange(async (value) => {
                    this.plugin.settings.insertDurationOnStop = value;
                    await this.plugin.saveSettings();
                }));
    }
}
