'use client';
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons row pinned under the content. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** When false, Esc and a click on the backdrop do nothing (for ceremonies the player must acknowledge). */
  dismissible?: boolean;
}

const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

/**
 * Built on the native dialog element: showModal() makes the rest of the page inert, gives the backdrop
 * and closes on Esc. The Tab handler below keeps focus cycling inside instead of escaping to the browser UI.
 */
export function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [open]);

  const trapTab = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (node) => node.getClientRects().length > 0,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (!dismissible || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const outside =
      event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) close.current();
  };

  return (
    <dialog
      ref={dialog}
      className="ui-modal pixel-frame"
      data-size={size}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) close.current();
      }}
      onClick={closeOnBackdrop}
      onKeyDown={trapTab}
    >
      <header className="ui-modal-header">
        <h2 id={titleId}>{title}</h2>
        {dismissible ? <IconButton icon="x" label="Fechar janela" variant="ghost" size="sm" onClick={onClose} /> : null}
      </header>
      <div className="ui-modal-content">{open ? children : null}</div>
      {footer ? <footer className="ui-modal-footer">{footer}</footer> : null}
    </dialog>
  );
}
