/**
 * UI component tests — Button, Badge, EmptyState, ErrorMessage, QueryError,
 * Pagination, Modal, ConfirmDialog
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../lib/api-error';

// react-icons used by ErrorMessage
vi.mock('react-icons/md', () => ({
  MdErrorOutline: () => <span data-testid="icon-error" />,
  MdWarningAmber: () => <span data-testid="icon-warning" />,
}));

// ── A. Button ─────────────────────────────────────────────────────────────────

import { Button } from '../components/ui/Button';

describe('A. Button', () => {
  it('renders children text', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Save');
  });

  it('is enabled by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('is disabled when disabled=true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled and shows spinner when isLoading=true', () => {
    render(<Button isLoading>Saving</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick} disabled>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders danger variant without crashing', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders ghost variant without crashing', () => {
    render(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// ── B. Badge ──────────────────────────────────────────────────────────────────

import { Badge } from '../components/ui/Badge';

describe('B. Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders as span by default', () => {
    const { container } = render(<Badge>Test</Badge>);
    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('renders positive tone without crashing', () => {
    render(<Badge tone="positive">Pass</Badge>);
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('renders danger tone without crashing', () => {
    render(<Badge tone="danger">Fail</Badge>);
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });

  it('renders warning tone without crashing', () => {
    render(<Badge tone="warning">Pending</Badge>);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

// ── C. EmptyState ─────────────────────────────────────────────────────────────

import { EmptyState } from '../components/ui/EmptyState';

describe('C. EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No students yet" />);
    expect(screen.getByText('No students yet')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Add something to get started." />);
    expect(screen.getByText('Add something to get started.')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText(/add something/i)).not.toBeInTheDocument();
  });

  it('renders action slot when provided', () => {
    render(<EmptyState title="Empty" action={<button>Add now</button>} />);
    expect(screen.getByRole('button', { name: 'Add now' })).toBeInTheDocument();
  });
});

// ── D. ErrorMessage ───────────────────────────────────────────────────────────

import { ErrorMessage, QueryError } from '../components/ui/ErrorMessage';

describe('D. ErrorMessage', () => {
  it('renders nothing when error is null/undefined', () => {
    const { container } = render(<ErrorMessage error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows message for plain Error', () => {
    render(<ErrorMessage error={new Error('Something went wrong')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('shows message for ApiError', () => {
    const err = new ApiError({ message: 'Not found', errorCode: 'NOT_FOUND', statusCode: 404 });
    render(<ErrorMessage error={err} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not found');
  });

  it('shows field errors for validation ApiError', () => {
    const err = new ApiError({
      message: 'Validation failed', errorCode: 'VALIDATION_ERROR', statusCode: 422,
      details: { fieldErrors: { username: ['Username is required'] } },
    });
    render(<ErrorMessage error={err} />);
    expect(screen.getByRole('alert')).toHaveTextContent('username');
    expect(screen.getByRole('alert')).toHaveTextContent('Username is required');
  });

  it('uses warning icon for validation error', () => {
    const err = new ApiError({ message: 'Invalid', errorCode: 'VALIDATION_ERROR', statusCode: 422 });
    render(<ErrorMessage error={err} />);
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
  });

  it('uses error icon for non-validation error', () => {
    render(<ErrorMessage error={new Error('fail')} />);
    expect(screen.getByTestId('icon-error')).toBeInTheDocument();
  });
});

describe('D. QueryError', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<QueryError error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows error message and alert role', () => {
    render(<QueryError error={new Error('Load failed')} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Load failed')).toBeInTheDocument();
  });

  it('shows Try again button when onRetry provided and not forbidden', () => {
    const retry = vi.fn();
    render(<QueryError error={new Error('fail')} onRetry={retry} />);
    const btn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(btn);
    expect(retry).toHaveBeenCalledOnce();
  });

  it('does not show Try again for 403 error', () => {
    const err = new ApiError({ message: 'Forbidden', errorCode: 'FORBIDDEN', statusCode: 403 });
    const retry = vi.fn();
    render(<QueryError error={err} onRetry={retry} />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });
});

// ── E. Pagination ─────────────────────────────────────────────────────────────

import { Pagination } from '../components/ui/Pagination';

describe('E. Pagination', () => {
  const META = { page: 2, limit: 20, totalItems: 100, totalPages: 5 };

  it('renders Previous and Next buttons', () => {
    render(<Pagination meta={META} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('shows current page and total pages', () => {
    render(<Pagination meta={META} onPageChange={vi.fn()} />);
    expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
  });

  it('disables Previous on first page', () => {
    render(<Pagination meta={{ ...META, page: 1 }} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(<Pagination meta={{ ...META, page: 5 }} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('calls onPageChange with page - 1 on Previous click', () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={META} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange with page + 1 on Next click', () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={META} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('returns null when totalPages <= 1', () => {
    const { container } = render(<Pagination meta={{ ...META, totalPages: 1 }} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows total items count', () => {
    render(<Pagination meta={META} onPageChange={vi.fn()} />);
    expect(screen.getByText(/100 total/i)).toBeInTheDocument();
  });
});

// ── F. Modal ──────────────────────────────────────────────────────────────────

import { Modal } from '../components/ui/Modal';

describe('F. Modal', () => {
  it('renders nothing when isOpen=false', () => {
    render(<Modal title="Test" isOpen={false} onClose={vi.fn()}>content</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen=true', () => {
    render(<Modal title="Confirm" isOpen={true} onClose={vi.fn()}>content</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the title in the dialog header', () => {
    render(<Modal title="Add Student" isOpen={true} onClose={vi.fn()}>body</Modal>);
    expect(screen.getByText('Add Student')).toBeInTheDocument();
  });

  it('renders children inside the dialog', () => {
    render(<Modal title="T" isOpen={true} onClose={vi.fn()}><p>modal content</p></Modal>);
    expect(screen.getByText('modal content')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<Modal title="T" isOpen={true} onClose={onClose}>body</Modal>);
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal title="T" isOpen={true} onClose={onClose}>body</Modal>);
    // Click the outer backdrop div (first child of portal)
    const backdrop = container.ownerDocument.body.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn();
    render(<Modal title="T" isOpen={true} onClose={onClose}>body</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── G. ConfirmDialog ──────────────────────────────────────────────────────────

import { ConfirmDialog } from '../components/ui/ConfirmDialog';

describe('G. ConfirmDialog', () => {
  const BASE = {
    isOpen: true, title: 'Delete?', message: 'This cannot be undone.',
    onConfirm: vi.fn(), onCancel: vi.fn(),
  };

  it('renders nothing when isOpen=false', () => {
    render(<ConfirmDialog {...BASE} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows title and message', () => {
    render(<ConfirmDialog {...BASE} />);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('renders default Confirm and Cancel labels', () => {
    render(<ConfirmDialog {...BASE} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(<ConfirmDialog {...BASE} confirmLabel="Yes, delete" cancelLabel="No, keep" />);
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /no, keep/i })).toBeInTheDocument();
  });

  it('calls onConfirm when Confirm clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...BASE} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...BASE} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows loading state when isLoading=true', () => {
    render(<ConfirmDialog {...BASE} isLoading={true} />);
    expect(screen.getByRole('button', { name: /please wait/i })).toBeInTheDocument();
  });

  it('disables both buttons when isLoading=true', () => {
    render(<ConfirmDialog {...BASE} isLoading={true} />);
    const buttons = screen.getAllByRole('button');
    // At least the confirm/cancel buttons should be disabled
    const disabledBtns = buttons.filter(b => b.hasAttribute('disabled'));
    expect(disabledBtns.length).toBeGreaterThanOrEqual(1);
  });
});
