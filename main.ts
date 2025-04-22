import { App, Plugin, Editor, MarkdownView, Notice, PluginSettingTab, Setting } from 'obsidian';
import { resolve } from 'path';

interface TimerPluginSettings {
    playSound: boolean;
    customSoundPath: string;
    timeTrackerFilePath: string;
    captureActiveFile: boolean;
}

const DEFAULT_SETTINGS: TimerPluginSettings = {
    playSound: true,
    customSoundPath: 'timer_stop.mp3',
    timeTrackerFilePath: 'Time Tracker.md',
    captureActiveFile: true
}

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
        const tagRegex = /#(\S+)/g;
        const tags: string[] = [];
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            tags.push(match[0]);
        }
        return tags;
    }

    private getCurrentDate(): string {
        const date = new Date();
        return date.toISOString().split('T')[0];
    }

    private getDayOfWeek(): string {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Time Tracker file management
    private async ensureTimeTrackerFile(): Promise<boolean> {
        const filePath = this.settings.timeTrackerFilePath;
        try {
            const fileExists = await this.app.vault.adapter.exists(filePath);
            if (!fileExists) {
                await this.app.vault.create(
                    filePath,
                    'Time entries tracked by Obsidian Timer Plugin\n\n'
                );
                return true;
            }
            return true;
        } catch (error) {
            console.error('Failed to ensure Time Tracker file:', error);
            new Notice('Failed to create or access Time Tracker file');
            return false;
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
            cleanTaskDetails = cleanTaskDetails.replace(/#\S+/g, '');
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
        const filePath = this.settings.timeTrackerFilePath;
        try {
            const fileReady = await this.ensureTimeTrackerFile();
            if (!fileReady) return false;

            const formattedEntry = this.formatTimeEntry(entry);
            const fileContents = await this.app.vault.adapter.read(filePath);
            
            // Split the content into lines
            const lines = fileContents.split('\n');
            
            // Insert the new entry after the descriptive line and blank line (index 2)
            const insertPosition = 2;
            
            // Insert the new entry
            lines.splice(insertPosition, 0, formattedEntry);
            
            // Join the lines back together
            const updatedContents = lines.join('\n');

            await this.app.vault.adapter.write(filePath, updatedContents);
            new Notice(`Time entry added to ${filePath}`);
            return true;
        } catch (error) {
            console.error('Failed to add time entry:', error);
            new Notice('Failed to add time entry to Time Tracker file');
            return false;
        }
    }

    async onload() {
        await this.loadSettings();

        console.log('Loading Timer plugin');

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

        // Register the slash commands in specific order
        this.addCommand({
            id: 'start-timer',
            name: 'Timer: start',
            callback: () => {
                this.startTimer();
            }
        });

        this.addCommand({
            id: 'stop-timer',
            name: 'Timer: stop',
            callback: () => {
                this.stopTimer();
            }
        });

        this.addCommand({
            id: 'pause-timer',
            name: 'Timer: pause',
            callback: () => {
                this.pauseTimer();
            }
        });

        this.addCommand({
            id: 'insert-current-time',
            name: 'Timer: insert time',
            editorCallback: (editor: Editor) => {
                this.insertCurrentTime(editor);
            }
        });
    }

    onunload() {
        console.log('Unloading Timer plugin');
        if (this.timerInterval) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    private startTimer() {
        if (this.timerStatus === 'running') {
            new Notice('Timer is already running.');
            return;
        }

        if (this.timerStatus === 'paused') {
            // Resume the timer
            this.startTime = Date.now() - this.elapsedTime;
        } else {
            // Start a new timer
            this.startTime = Date.now();
            this.elapsedTime = 0;
        }

        this.timerStatus = 'running';
        
        // Update status bar every second
        this.timerInterval = window.setInterval(() => {
            this.updateStatusBar();
        }, 1000);
        
        this.updateStatusBar();
        new Notice('Timer started.');
    }

    private pauseTimer() {
        if (this.timerStatus !== 'running') {
            new Notice('Timer is not running.');
            return;
        }

        this.elapsedTime = Date.now() - this.startTime;
        this.timerStatus = 'paused';
        
        if (this.timerInterval) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        this.updateStatusBar();
        new Notice('Timer paused. Elapsed time: ' + this.formatElapsedTime(this.elapsedTime));
    }

    private async playTimerSound() {
        if (!this.settings.playSound) return;

        try {
            // Get the plugin directory path
            const pluginDir = this.app.vault.configDir + '/plugins/obsidian-timer-plugin';
            const soundPath = resolve(pluginDir, this.settings.customSoundPath);
            
            // Create audio element
            const audio = new Audio();
            
            // Convert file path to proper URL
            audio.src = `file://${soundPath}`;
            
            // Wait for audio to load before playing
            audio.addEventListener('canplaythrough', () => {
                audio.play().catch(error => {
                    console.error('Failed to play timer sound:', error);
                    new Notice('Failed to play timer sound. Please check your sound settings.');
                });
            });

            audio.addEventListener('error', (error) => {
                console.error('Error loading timer sound:', error);
                new Notice('Failed to load timer sound file. Please check if the file exists.');
            });

        } catch (error) {
            console.error('Failed to initialize timer sound:', error);
            new Notice('Failed to initialize timer sound. Please check your sound settings.');
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
        
        if (this.timerInterval) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
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
        const editor = view?.editor || this.lastActiveEditor;
        if (editor) {
            editor.replaceSelection(formattedTime);
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
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;
        
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }

    private updateStatusBar() {
        if (!this.statusBarItem) return;

        // Remove all state classes first
        this.statusBarItem.removeClass('timer-running');
        this.statusBarItem.removeClass('timer-ready');

        switch (this.timerStatus) {
            case 'running':
                const currentElapsedTime = Date.now() - this.startTime;
                this.statusBarItem.setText(`⏱️ ${this.formatElapsedTime(currentElapsedTime)}`);
                this.statusBarItem.addClass('timer-running');
                this.statusBarItem.title = 'Click to stop timer';
                break;
            case 'paused':
                this.statusBarItem.setText(`⏸️ ${this.formatElapsedTime(this.elapsedTime)}`);
                this.statusBarItem.addClass('timer-ready');
                this.statusBarItem.title = 'Click to start timer';
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

        containerEl.createEl('h2', {text: 'Timer Settings'});

        new Setting(containerEl)
            .setName('Play Sound')
            .setDesc('Play a sound when the timer stops')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.playSound)
                .onChange(async (value) => {
                    this.plugin.settings.playSound = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Custom Sound Path')
            .setDesc('Path to custom sound file (relative to plugin directory)')
            .addText(text => text
                .setPlaceholder('timer_stop.mp3')
                .setValue(this.plugin.settings.customSoundPath)
                .onChange(async (value) => {
                    this.plugin.settings.customSoundPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Time Tracker File Path')
            .setDesc('Path to the time tracker file')
            .addText(text => text
                .setPlaceholder('Time Tracker.md')
                .setValue(this.plugin.settings.timeTrackerFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.timeTrackerFilePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Capture Active File')
            .setDesc('Capture time entries for the active file')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.captureActiveFile)
                .onChange(async (value) => {
                    this.plugin.settings.captureActiveFile = value;
                    await this.plugin.saveSettings();
                }));
    }
}