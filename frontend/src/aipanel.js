import { LoadHTMLFile } from '../wailsjs/go/main/App.js';
import { EventsOn, EventsOff } from "../wailsjs/runtime/runtime.js";
import { Logger } from './logger.js';
import { QueryOpenRouter, Ping } from '../wailsjs/go/main/App.js';
import { marked } from 'marked';
import { markedHighlight } from "marked-highlight";
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-light.min.css';  
import tplAi from '../src/assets/templates/ai.html?raw';

// Configure marked with highlight extension
marked.use(markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
}));

export class AiPanel {
    constructor(tabId, paneData) {
        this.logger = new Logger('AI-Robot');
        this.elements = {};
        this.tabId = tabId;
        this.paneData = paneData;
        this.panel = null;
        this.currentModel = 'meta-llama/llama-3.3-70b-instruct:free';
        this.currentAssistantMessage = null; // Track current assistant message
        this.currentMessageDiv = null; // Track current message div for smooth updates
        
        // Store bound methods to preserve context
        this.boundOnStreamToken = this.onStreamToken.bind(this);
        this.boundOnStreamComplete = this.onStreamComplete.bind(this);
        this.AIInfotext = `Wissensstand: „Was ist dein Wissens-Cutoff? Bis zu welchem Monat/Jahr reichen deine Trainingsdaten?“
Identität: „Welches Modell bist du genau und in welcher Version arbeitest du?“
Fähigkeiten: „Erstelle mir eine Liste deiner Kernkompetenzen. Kannst du Bilder erstellen, Dateien analysieren oder im Internet surfen?“`;
        
        this.init();
    }

    async init() {
        await this.createPanel();
        this.cacheDOMElements();
        this.setupEventListeners();
        this.setDefaultModel();
        this.updateStatusDot();
        setInterval(this.updateStatusDot, 30000);
    }

    async createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = `ai-panel-${this.tabId}`;
        this.panel.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 10;';
        this.panel.innerHTML = tplAi;
        this.paneData.dom.appendChild(this.panel);
    }

   /**
     * DOM Elemente finden und cachen
     */
    cacheDOMElements() {
        const ids = [
            'ai-model-selector','ai-pricing','ai-start-message'
        ];

        ids.forEach(id => {
            const element = this.panel.querySelector(`#${id}`);
            this.elements[id] = element;
            console.log(`Element ${id}:`, element);
        });

        this.logger.info('DOM elements found:', Object.keys(this.elements).filter(k => this.elements[k]));
    }    

    registerStreamEvents() {
        this.logger.info("🔧 Stream Events registriert");
        EventsOn("stream_token", this.boundOnStreamToken);
        EventsOn("stream_complete", this.boundOnStreamComplete);
    }

    unregisterStreamEvents() {
        this.logger.info("🔧 Stream Events entfernt/unregister");
        EventsOff("stream_token", this.boundOnStreamToken);
        EventsOff("stream_complete", this.boundOnStreamComplete);
    }

    setupEventListeners() {
        // Cache DOM elements
        this.startBtn = this.panel.querySelector('.btn-start');
        this.stopBtn = this.panel.querySelector('.btn-stop');
        this.promptInput = this.panel.querySelector('.prompt-input');
        this.workingIndicator = this.panel.querySelector('.working-indicator');
        this.clearBtn = this.panel.querySelector('.btn-clear');
        const navButtons = this.panel.querySelectorAll('.toolbar-nav .btn-tool');
        
        // Model selector
        const modelSelector = this.elements['ai-model-selector'];
        
        if (modelSelector) {
            modelSelector.addEventListener('change', (e) => {
                this.onModelChange(e.target.value);
            });
        } else {
            this.logger.error('Model selector element not found!');
        }

        // Start/Stop buttons
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.onStartClick());
        }
        
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.onStopClick());
        }

        // Clear button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearInput());
        }

        // Prompt input (Shift+Enter handling)
        if (this.promptInput) {
            this.promptInput.addEventListener('keydown', (e) => { 
                
                if (e.key === 'Enter' && e.shiftKey) {
                    //console.log('Shift+Enter pressed');
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.onStartClick();
                }
            });
        }

        // Füge jedem Button einen Klick-EventListener hinzu
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Hole den Text des geklickten Buttons
                const buttonText = button.textContent;

                if(buttonText === 'Chat leeren') {
                    this.clearChat();
                }
                if(buttonText === 'KI Info') {
                    this.panel.querySelector('.prompt-input').value = this.AIInfotext.trim();
                }
            });
        });
        
    }

    onModelChange(modelValue) { 
        this.currentModel = modelValue;
        const option = document.querySelector(`#ai-model-selector option[value="${modelValue}"]`);
        if (option) {
            this.updatePricingDisplay(option.dataset);
            this.updateAiInfo(option.dataset);
        }
    }

    // Funktion, um den Status-Dot zu aktualisieren
    async updateStatusDot() {
        const isOnline = await Ping("abf24.net");
        let statusDot = document.querySelector('.status-dot');

        if (!statusDot){
            statusDot = document.querySelector('.status-dot-red');
        }

        if (isOnline.includes("successful")) {
            statusDot.classList.remove('status-dot-red');
            statusDot.classList.add('status-dot');
        } else {
            statusDot.classList.remove('status-dot');
            statusDot.classList.add('status-dot-red');
        }
    }

    updatePricingDisplay(data) {

        const pricingDiv = this.panel.querySelector('#ai-pricing');
        if (pricingDiv) {
            pricingDiv.innerHTML = `
                <dl>
                <dt>In tokens price</dt>
                <dd>${data.inputpreis || '0,00$'}</dd>
                <dt>Out tokens price</dt>
                <dd>${data.outputpreis || '0,00$'}</dd>
                <dt>Max Output</dt>
                <dd>${data.maxoutput || '0.00K'}</dd>
                </dl>
            `;
        }

    }

    updateAiInfo(data) {
        const infoElement = this.panel.querySelector('#ai-knowledge');
        if (infoElement) {
            if (data.aitype) {
                let c = data.aitype.split("|");
                infoElement.innerHTML = ''; // clear the existing content
                c.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.classList.add('infolist');
                    listItem.textContent = item;
                    infoElement.appendChild(listItem);
                });
            } else {
                infoElement.innerHTML = ''; // clear the existing content
            }
        }
    }  

    optimizeAIPrompt(prompt) {
        if (!prompt) return '';

        // Normalize whitespace: collapse all whitespace (including newlines) to single space
        // Keep all meaningful characters: punctuation, symbols, emojis, etc.
        return prompt
            .replace(/\s+/g, ' ')  // replaces \r\n, \n, \t, multiple spaces → single space
            .trim();
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/\n/g, "<br>")
            .replace(/'/g, "&#039;");
    }

    async onStartClick() {
        let prompt = this.promptInput?.value;
        
        if (!prompt) {
            this.logger.warn('Empty prompt, not sending');
            return;
        }

        this.toggleStartMessage();
        const [provider,model] = this.currentModel.split('/');
        this.logger.info('Sending prompt:', prompt, 'with model:', model);
        
        // Show working indicator
        this.setWorkingState(true);
        this.currentAssistantMessage = '';
        this.registerStreamEvents();
        this.addMessageToHistory('user', prompt);
        prompt = this.optimizeAIPrompt(prompt); // prompt optimieren vor senden
        
        try {
            await QueryOpenRouter(this.currentModel, prompt, this.promptInput.value, '');
        } catch (error) {
            this.logger.error('Error sending prompt:', error);
        } finally {
            // Code to be executed regardless of whether an error occurred or not
            this.setWorkingState(false);
            this.promptInput.value = '';
            this.unregisterStreamEvents();
        }        
    }

    onStopClick() {
        this.logger.info('Stopping AI response...');
        this.setWorkingState(false);
        // TODO: Implement stop functionality
    }

    setWorkingState(isWorking) {
        if (this.workingIndicator) {
            this.workingIndicator.style.display = isWorking ? 'inline-block' : 'none';
        }
        
        if (this.startBtn) {
            this.startBtn.disabled = isWorking;
        }
    }

    onStreamToken(data) {
        if (!data || typeof data.token !== "string") return;
        
        // Initialize message on first token
        if (!this.currentMessageDiv) {
            this.currentMessageDiv = document.createElement('div');
            this.currentMessageDiv.className = 'message assistant';
            this.currentAssistantMessage = '';
            
            const chatHistory = this.panel.querySelector('.chat-history');
            if (chatHistory) {
                chatHistory.appendChild(this.currentMessageDiv);
            }
        }
        
        // Append token and update
        this.currentAssistantMessage += data.token;
        this.currentMessageDiv.innerHTML = marked.parse(this.currentAssistantMessage);
        
        // Add copy buttons to code blocks
        this.addCopyButtonsToCodeBlocks();
        
        // Smooth scroll to bottom
        const chatHistory = this.panel.querySelector('.chat-history');
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }    

    onStreamComplete(data) {
        this.logger.info("🏁 Streaming abgeschlossen:", data);
        this.unregisterStreamEvents();

        // Hide working indicator
        this.setWorkingState(false);

        // // Reset for next response
        this.currentMessageDiv = null;

        this.toggleStartMessage();
        // Final scroll to bottom
        const chatHistory = this.panel.querySelector('.chat-history');
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }

    addMessageToHistory(role, content) {
        const chatHistory = this.panel.querySelector('.chat-history');
        if (!chatHistory) return;
        content = this.escapeHtml(content);

        const messageDiv = document.createElement('div');
        messageDiv.className = `bubble`;
        messageDiv.innerHTML = `
            <div>
                ${content}
            </div>
        `;

        chatHistory.appendChild(messageDiv);

        // Animiere die Opazität von 0 auf 1
        messageDiv.style.opacity = 0;
        messageDiv.style.transition = 'opacity 0.5s ease-in-out';
        setTimeout(() => {
            messageDiv.style.opacity = 1;
        }, 0);

        chatHistory.scrollTop = chatHistory.scrollHeight;

    }

    show() {
        if (this.panel) {
            this.panel.style.display = 'block';
        }
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    toggleStartMessage(){
        const startMessage = this.elements['ai-start-message'];
        if (startMessage) {
            startMessage.style.display = startMessage.style.display === 'none' ? 'block' : 'none';
        }
    }

    clearChat(){
        const chatHistory = this.panel.querySelector('.chat-history');
        if (chatHistory) {
            chatHistory.innerHTML = '';
        }
    }

    clearInput(){
        if (this.promptInput) {
            const placeholder = this.promptInput.placeholder;
            this.promptInput.value = '';
            this.promptInput.focus();
            this.promptInput.placeholder = placeholder; // Repaint erzwingen sonst halber Text
        }
    }

    addCopyButtonsToCodeBlocks() {
        if (!this.currentMessageDiv) return;
        
        const codeBlocks = this.currentMessageDiv.querySelectorAll('pre code');
        codeBlocks.forEach((codeBlock) => {
            const pre = codeBlock.parentElement;
            
            // Skip if already has copy button
            if (pre.querySelector('.copy-button')) return;
            
            // Create copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-button';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Code kopieren';
            copyBtn.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 12px;
                opacity: 0;
                transition: opacity 0.2s;
            `;
            
            // Make pre relative for absolute positioning
            pre.style.position = 'relative';
            
            // Show/hide on hover
            pre.addEventListener('mouseenter', () => {
                copyBtn.style.opacity = '1';
            });
            
            pre.addEventListener('mouseleave', () => {
                copyBtn.style.opacity = '0';
            });
            
            // Copy functionality
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(codeBlock.textContent);
                    copyBtn.innerHTML = '✅';
                    copyBtn.title = 'Kopiert!';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋';
                        copyBtn.title = 'Code kopieren';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy code:', err);
                    copyBtn.innerHTML = '❌';
                    copyBtn.title = 'Fehler beim Kopieren';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋';
                        copyBtn.title = 'Code kopieren';
                    }, 2000);
                }
            });
            
            pre.appendChild(copyBtn);
        });
    }

    destroy() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
    }

   setDefaultModel() {
        const selector = this.elements['ai-model-selector'];
        const option = document.querySelector(`#ai-model-selector option[value="${selector.value}"]`);

        if (!selector) {
            this.logger.error("setDefaultModel failed: AI model selector element not found.");
            return;
        }

        const htmlValue = selector.value;
        const firstOptionValue = selector.options[0]?.value;
        this.currentModel = htmlValue || firstOptionValue || '';

        if (selector.value !== this.currentModel) {
            selector.value = this.currentModel;
        }

        if (this.currentModel) {
            this.logger.info(`AI Model initialized: ${this.currentModel} ${htmlValue ? '(via HTML)' : '(via Default)'}`);
        } else {
            this.logger.warn("AI Model initialization failed: No valid model found.");
        }

        this.updatePricingDisplay(option.dataset);
        this.updateAiInfo(option.dataset);
    }    
}
