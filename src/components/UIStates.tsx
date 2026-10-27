import React, { ErrorInfo, ReactNode, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';

type StateAction = {
  label: string;
  onClick: () => void;
};

export const PageLoader: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <LoaderCircle className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      </div>
      <h1 className="text-base font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  </div>
);

export const SectionLoader: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600" role="status">
    <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none text-emerald-600" aria-hidden="true" />
    {label}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: StateAction;
  secondaryAction?: StateAction;
  icon?: ReactNode;
}> = ({ title, description, action, secondaryAction, icon }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-7 text-center shadow-sm" aria-label={title}>
    {icon && <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</div>}
    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
    <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-slate-600">{description}</p>
    {(action || secondaryAction) && (
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {action && <button type="button" onClick={action.onClick} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{action.label}</button>}
        {secondaryAction && <button type="button" onClick={secondaryAction.onClick} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{secondaryAction.label}</button>}
      </div>
    )}
  </section>
);

export const ErrorState: React.FC<{
  title: string;
  description: string;
  action?: StateAction;
  secondaryAction?: StateAction;
}> = ({ title, description, action, secondaryAction }) => (
  <section className="rounded-xl border border-rose-200 bg-rose-50/60 p-6" role="alert">
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
      <div>
        <h2 className="text-sm font-bold text-rose-950">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-rose-900">{description}</p>
        {(action || secondaryAction) && <div className="mt-4 flex flex-wrap gap-2">
          {action && <button type="button" onClick={action.onClick} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800">{action.label}</button>}
          {secondaryAction && <button type="button" onClick={secondaryAction.onClick} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-50">{secondaryAction.label}</button>}
        </div>}
      </div>
    </div>
  </section>
);

export const InlineError: React.FC<{ children: ReactNode }> = ({ children }) => (
  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">{children}</p>
);

export const WarningBanner: React.FC<{
  title: string;
  children: ReactNode;
  action?: StateAction;
  secondaryAction?: StateAction;
}> = ({ title, children, action, secondaryAction }) => (
  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950" role="status">
    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <strong>{title}</strong>
      <div className="mt-0.5 text-amber-900">{children}</div>
      {(action || secondaryAction) && <div className="mt-2 flex flex-wrap gap-2">
        {action && <button type="button" onClick={action.onClick} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100">{action.label}</button>}
        {secondaryAction && <button type="button" onClick={secondaryAction.onClick} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100">{secondaryAction.label}</button>}
      </div>}
    </div>
  </div>
);

export const OperationStatus: React.FC<{
  status: 'idle' | 'preparing' | 'training' | 'paused' | 'saving' | 'evaluating' | 'completed' | 'failed';
  detail?: string;
}> = ({ status, detail }) => {
  if (status === 'idle') return null;
  const copy: Record<typeof status, string> = {
    preparing: 'Preparing',
    training: 'Training in progress',
    paused: 'Training paused',
    saving: 'Saving checkpoint',
    evaluating: 'Evaluating policy',
    completed: 'Operation completed',
    failed: 'Operation needs attention',
  };
  const Icon = status === 'completed' ? CheckCircle2 : status === 'failed' ? AlertCircle : status === 'paused' ? Info : LoaderCircle;
  const active = ['preparing', 'training', 'saving', 'evaluating'].includes(status);
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600" role="status" aria-live="polite">
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'animate-spin motion-reduce:animate-none text-emerald-600' : status === 'failed' ? 'text-rose-600' : 'text-slate-500'}`} aria-hidden="true" />
      <span className="font-medium">{copy[status]}{detail ? ` — ${detail}` : ''}</span>
    </div>
  );
};

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const ToastViewport: React.FC<{
  toast: ToastMessage | null;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dismissRef.current(), 4500);
    return () => window.clearTimeout(timer);
  }, [toast?.id]);
  if (!toast) return null;
  const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertCircle : toast.kind === 'warning' ? TriangleAlert : Info;
  const style = toast.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : toast.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-950' : toast.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950';
  return (
    <div className={`fixed bottom-4 right-4 z-[100] flex max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg ${style}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export const ConfirmationDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, description, confirmLabel, destructive = false, onConfirm, onCancel }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancelRef.current();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 id="confirmation-title" className="text-base font-bold text-slate-900">{title}</h2>
        <p id="confirmation-description" className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={onConfirm} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${destructive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application rendering failed', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
          <div className="w-full max-w-lg">
            <ErrorState
              title="This screen couldn't be displayed"
              description="The application hit an unexpected display problem. Your saved agent data has not been intentionally changed. Reload the page to try again."
              action={{ label: 'Reload application', onClick: () => window.location.reload() }}
            />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
