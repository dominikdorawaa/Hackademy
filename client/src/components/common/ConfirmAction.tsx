import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { errorText } from '../../lib/errorText';
import { StatusMessage } from './StatusMessage';

export function ConfirmAction({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  returnFocus,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  returnFocus?: (confirmed: boolean) => HTMLElement | null | undefined;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const confirmed = useRef(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      confirmed.current = true;
      setOpen(false);
    } catch (err) {
      setError(errorText(err, 'Nie udało się wykonać operacji. Spróbuj ponownie.'));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => {
      if (!inFlight.current) {
        if (next) confirmed.current = false;
        setOpen(next);
        setError(null);
      }
    }}>
      {trigger && <AlertDialogTrigger asChild disabled={pending}>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent onCloseAutoFocus={(event) => {
        const target = returnFocus?.(confirmed.current);
        confirmed.current = false;
        if (target) {
          event.preventDefault();
          target.focus();
        }
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {pending ? 'Trwa wykonywanie…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
