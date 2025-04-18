import { App, Plugin, Editor, MarkdownView, Notice, PluginSettingTab, Setting } from 'obsidian';

interface TimerPluginSettings {
    playSound: boolean;
    customSoundPath: string;
}

const DEFAULT_SETTINGS: TimerPluginSettings = {
    playSound: true,
    customSoundPath: 'timer_stop.mp3'
}

export default class TimerPlugin extends Plugin {
    settings: TimerPluginSettings;
    private timerStatus: 'stopped' | 'running' | 'paused' = 'stopped';
    private startTime: number = 0;
    private elapsedTime: number = 0;
    private timerInterval: number | null = null;
    private statusBarItem: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        console.log('Loading Timer plugin');

        // Create status bar item
        this.statusBarItem = this.addStatusBarItem();
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

    private stopTimer() {
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
        if (this.settings.playSound) {
            try {
                const audio = new Audio(this.app.vault.adapter.getResourcePath(this.settings.customSoundPath));
                audio.play().catch(error => {
                    console.error('Failed to play timer sound:', error);
                });
            } catch (error) {
                console.error('Failed to load timer sound:', error);
            }
        }

        // Insert elapsed time at cursor
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            const editor = view.editor;
            const formattedTime = this.formatElapsedTime(elapsedTime);
            editor.replaceSelection(formattedTime);
        }
        
        this.updateStatusBar();
        new Notice('Timer stopped. Total time: ' + this.formatElapsedTime(elapsedTime));
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

        switch (this.timerStatus) {
            case 'running':
                const currentElapsedTime = Date.now() - this.startTime;
                this.statusBarItem.setText(`⏱️ ${this.formatElapsedTime(currentElapsedTime)}`);
                break;
            case 'paused':
                this.statusBarItem.setText(`⏸️ ${this.formatElapsedTime(this.elapsedTime)}`);
                break;
            case 'stopped':
                this.statusBarItem.setText('⏱️ Timer ready');
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
    }
}