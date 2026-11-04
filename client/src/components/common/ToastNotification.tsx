import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, Info, Trophy, X } from 'lucide-react';
import './ToastNotification.css';

const ToastNotification = ({ message, type = 'success', onClose }: { message: string; type?: string; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const success = type === 'success';
  const info = type === 'info';
  const Icon = success ? Trophy : info ? Info : CircleAlert;

  let title = "Powiadomienie";
  if (message.includes("odznakę")) title = "Nowa Odznaka!";
  else if (type === 'success') title = "Sukces";
  else if (type === 'error') title = "Błąd";

  return createPortal(
    <div className="px-toast px-panel" data-type={success ? 'success' : info ? 'info' : 'error'}>
      <span className="px-toast-icon" aria-hidden="true"><Icon /></span>
      <div className="px-toast-copy">
        <h4 className="px-toast-title">{title}</h4>
        <p className="px-toast-message">{message}</p>
      </div>
      <button type="button" className="px-toast-close" onClick={onClose} aria-label="Zamknij powiadomienie">
        <X aria-hidden="true" />
      </button>
      <span className="px-toast-timer" aria-hidden="true" />
    </div>,
    document.body,
  );
};

export default ToastNotification;
