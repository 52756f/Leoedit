import { APP_CONFIG } from '../constants.js';
import gembackImage from '../assets/images/gemback3.png';

export function showAboutDialog() {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'about-modal';
    modal.innerHTML = `
        <div class="about-content">
            <div class="about-header">
                <h2>${APP_CONFIG.NAME}</h2>
                <button class="close-btn" onclick="this.closest('.about-modal').remove()">&times;</button>
            </div>
            <div class="about-body">
                <p>Version: ${APP_CONFIG.VERSION}</p>
                <p>${APP_CONFIG.DESCRIPTION}</p>    
                <img src="${gembackImage}" alt="App Icon" >
                <div class="about-info">
                    <p>${APP_CONFIG.AUTHOR}</p>
                    <p>${APP_CONFIG.COPYRIGHT}</p>
                </div>
            </div>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .about-modal {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .about-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            min-width: 300px;
            max-width: 500px;
        }

        .about-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }

        .about-header h2 {
            margin: 0;
            color: #333;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: default;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
        }

        .close-btn:hover {
            color: #333;
        }

        .about-body {
            color: #666;
        }

        .about-info {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 0.9em;
        }

        .about-body p {
            margin: 10px 0;
        }
    `;

    // Add to document
    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Close on escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    });
}
