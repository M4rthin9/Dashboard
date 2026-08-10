export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: AlertType;
  ok?: string;
}

export interface AlertBox {
  title: string;
  message?: string;
  type: AlertType;
  okText?: string;
}

class UIStore {
  darkMode = $state(false);
  toasts = $state<Toast[]>([]);
  alert = $state<AlertBox | null>(null);
  private toastSeq = 0;

  initDarkMode(): void {
    const saved = localStorage.getItem('ccc_dark_mode');
    this.darkMode = saved === '1';
    this.applyDarkClass();
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    localStorage.setItem('ccc_dark_mode', this.darkMode ? '1' : '0');
    this.applyDarkClass();
  }

  private applyDarkClass(): void {
    document.documentElement.classList.toggle('dark', this.darkMode);
  }

  showToast(message: string, type: Toast['type'] = 'info', duration = 4000, ok?: string): void {
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, { id, message, type, ok }];
    if (!ok) {
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, duration);
    }
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  showAlert(options: AlertBox): void {
    this.alert = options;
  }

  closeAlert(): void {
    this.alert = null;
  }
}

export const ui = new UIStore();
