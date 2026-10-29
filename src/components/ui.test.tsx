import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  PageHeader,
  Section,
  Spinner,
  StatCard,
} from './ui';

describe('ui primitives', () => {
  it('renders alerts with the right role', () => {
    const { rerender } = render(<Alert>Something broke</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');

    rerender(<Alert tone="success">Saved</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('renders a field with an optional hint', () => {
    const { rerender } = render(
      <Field label="APR" hint="Annual rate">
        <input aria-label="apr-input" />
      </Field>,
    );

    expect(screen.getByText('APR')).toBeInTheDocument();
    expect(screen.getByText('Annual rate')).toBeInTheDocument();

    rerender(
      <Field label="APR">
        <input aria-label="apr-input" />
      </Field>,
    );
    expect(screen.queryByText('Annual rate')).not.toBeInTheDocument();
  });

  it('renders a page header with optional parts', () => {
    const { rerender } = render(
      <PageHeader title="Accounts" subtitle="Your balances" actions={<button>Add</button>} />,
    );

    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getByText('Your balances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();

    rerender(<PageHeader title="Accounts" />);
    expect(screen.queryByText('Your balances')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a section with optional description and actions', () => {
    const { rerender } = render(
      <Section title="Inputs" description="Fill these" actions={<button>Reset</button>}>
        <p>Body</p>
      </Section>,
    );

    expect(screen.getByRole('heading', { name: 'Inputs' })).toBeInTheDocument();
    expect(screen.getByText('Fill these')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();

    rerender(
      <Section title="Inputs">
        <p>Body</p>
      </Section>,
    );
    expect(screen.queryByText('Fill these')).not.toBeInTheDocument();
  });

  it('renders stat cards with hints and tones', () => {
    const { rerender } = render(<StatCard label="Balance" value="$10" hint="Total" />);
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();

    rerender(<StatCard label="APR" value="25%" tone="warning" />);
    expect(screen.getByText('25%')).toHaveClass('stat-value-warning');
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  it('renders badges with the requested tone', () => {
    const { rerender } = render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('badge-muted');

    rerender(<Badge tone="ok">Good</Badge>);
    expect(screen.getByText('Good')).toHaveClass('badge-ok');
  });

  it('renders a spinner with and without a label', () => {
    const { rerender } = render(<Spinner label="Loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');

    rerender(<Spinner />);
    expect(screen.getByRole('status')).not.toHaveTextContent('Loading');
  });

  it('renders an empty state with optional parts', () => {
    const { rerender } = render(
      <EmptyState
        title="Nothing here"
        description="Add something"
        action={<button>Go</button>}
      />,
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();

    rerender(<EmptyState title="Nothing here" />);
    expect(screen.queryByText('Add something')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
