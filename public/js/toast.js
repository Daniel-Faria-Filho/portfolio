class Toast {
    static container = null;

    static init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    static show(message, type = 'info', duration = 5000) {
        // Only show error toasts
        if (type !== 'error') return;

        this.init();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            error: '❌',
            success: '✅',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon ${type}">${icons[type]}</span>
                <span class="toast-message">${message}</span>
            </div>
            <button class="toast-close">×</button>
            <div class="toast-progress">
                <div class="toast-progress-bar"></div>
            </div>
        `;

        this.container.appendChild(toast);

        // Animate progress bar
        const progressBar = toast.querySelector('.toast-progress-bar');
        progressBar.style.width = '100%';
        progressBar.style.transition = `width ${duration}ms linear`;
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 50);

        const close = () => {
            toast.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                this.container.removeChild(toast);
            }, 300);
        };

        toast.querySelector('.toast-close').addEventListener('click', close);

        if (duration) {
            setTimeout(close, duration);
        }

        return toast;
    }

    static error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    static success(message, duration) {
        return this.show(message, 'success', duration);
    }

    static info(message, duration) {
        return this.show(message, 'info', duration);
    }
} 