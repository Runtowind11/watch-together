interface ToastProps {
  message: string;
  type: 'info' | 'success' | 'error';
}

export default function Toast({ message, type }: ToastProps) {
  return (
    <div className={`toast toast-${type}`}>
      {message}
    </div>
  );
}
