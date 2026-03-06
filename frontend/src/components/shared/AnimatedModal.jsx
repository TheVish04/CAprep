import { AnimatePresence, motion } from 'motion/react';
import {
  createContext, useContext, useEffect, useRef, useState
} from 'react';
import './AnimatedModal.css';

/* ─── Context ──────────────────────────────────────────────────────────── */

const ModalContext = createContext(undefined);

export const ModalProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <ModalContext.Provider value={{ open, setOpen }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within a ModalProvider');
  return ctx;
};

/* ─── Outside-click hook ────────────────────────────────────────────────── */

export const useOutsideClick = (ref, callback) => {
  useEffect(() => {
    const handler = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      callback(e);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [ref, callback]);
};

/* ─── Public API ────────────────────────────────────────────────────────── */

/** Root wrapper — provides context. */
export function Modal({ children }) {
  return <ModalProvider>{children}</ModalProvider>;
}

/** Button that triggers the modal open. */
export const ModalTrigger = ({ children, className = '' }) => {
  const { setOpen } = useModal();
  return (
    <button
      className={`animated-modal-trigger ${className}`}
      onClick={() => setOpen(true)}
    >
      {children}
    </button>
  );
};

/** Animated overlay + modal shell. Put your content inside ModalContent. */
export const ModalBody = ({ children, className = '' }) => {
  const { open, setOpen } = useModal();
  const modalRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useOutsideClick(modalRef, () => setOpen(false));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="animated-modal-scene"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        >
          {/* Dark overlay */}
          <motion.div
            className="animated-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          />

          {/* Spring-animated card */}
          <motion.div
            ref={modalRef}
            className={`animated-modal-card ${className}`}
            initial={{ opacity: 0, scale: 0.5, rotateX: 40, y: 40 }}
            animate={{ opacity: 1, scale: 1,  rotateX: 0,  y: 0  }}
            exit={{ opacity: 0, scale: 0.8, rotateX: 10 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15 }}
          >
            <CloseIcon />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Padded content area inside the card. */
export const ModalContent = ({ children, className = '' }) => (
  <div className={`animated-modal-content ${className}`}>{children}</div>
);

/** Footer bar inside the card. */
export const ModalFooter = ({ children, className = '' }) => (
  <div className={`animated-modal-footer ${className}`}>{children}</div>
);

/* ─── Internal close button ─────────────────────────────────────────────── */
const CloseIcon = () => {
  const { setOpen } = useModal();
  return (
    <button className="animated-modal-close" onClick={() => setOpen(false)} aria-label="Close">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </svg>
    </button>
  );
};

/* ─── Legacy wrapper (backward-compat for isOpen/onClose prop pattern) ─── */

/**
 * Legacy/programmatic usage:
 *   <AnimatedModal isOpen={bool} onClose={fn}>…</AnimatedModal>
 * 
 * Internally creates a Modal context driven by the `isOpen` prop.
 */
const AnimatedModalLegacy = ({ isOpen, onClose, children, className = '' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="animated-modal-scene"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        >
          <motion.div
            className="animated-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            onClick={onClose}
          />
          <motion.div
            className={`animated-modal-card ${className}`}
            initial={{ opacity: 0, scale: 0.5, rotateX: 40, y: 40 }}
            animate={{ opacity: 1, scale: 1,  rotateX: 0,  y: 0  }}
            exit={{ opacity: 0, scale: 0.8, rotateX: 10 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="animated-modal-close" onClick={onClose} aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
            <div className="animated-modal-content">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedModalLegacy;
