import type { ReactNode } from 'react';
import { Button, Modal } from '@/ui/kit';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmQa?: string;
}

/** A yes/no question before something that costs Commits or cannot be undone. */
export function ConfirmDialog({ open, title, children, confirmLabel, danger = false, disabled = false, onConfirm, onCancel, confirmQa }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={disabled} onClick={onConfirm} data-qa={confirmQa}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="hk-confirm">{children}</div>
    </Modal>
  );
}
