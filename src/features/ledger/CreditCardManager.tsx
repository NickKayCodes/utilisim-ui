import React, { useEffect, useMemo, useState } from 'react';
import {
  createCard,
  deleteCard,
  getCards,
  updateCard,
  type CreditCard,
} from './ledger.service';

interface CreditCardForm {
  name: string;
  balance: string;
  minimumPayment: string;
  apr: string;
}

const createEmptyForm = (): CreditCardForm => ({
  name: '',
  balance: '',
  minimumPayment: '',
  apr: '',
});

const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toFixed(2) : '0.00';

const CreditCardManager: React.FC = () => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [form, setForm] = useState<CreditCardForm>(createEmptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCards() {
      setLoading(true);
      const response = await getCards();
      if (response.success && response.data) {
        setCards(response.data);
      }
      setLoading(false);
    }

    loadCards();
  }, []);

  const totalBalance = useMemo(() => {
    return cards.reduce((sum, card) => sum + Number(card.balance || 0), 0);
  }, [cards]);

  function updateField(field: keyof CreditCardForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormMessage(null);

    const payload = {
      name: form.name.trim(),
      balance: Number(form.balance),
      minimumPayment: Number(form.minimumPayment),
      apr: Number(form.apr),
    };

    if (
      !payload.name ||
      Number.isNaN(payload.balance) ||
      Number.isNaN(payload.minimumPayment) ||
      Number.isNaN(payload.apr)
    ) {
      setFormError('Please provide valid values for all card fields.');
      return;
    }

    setLoading(true);

    if (editingId) {
      const response = await updateCard(editingId, payload);
      if (response.success && response.data) {
        setCards((current) =>
          current.map((card) =>
            card.id === editingId ? response.data! : card,
          ),
        );
        setFormMessage('Credit card updated successfully.');
      } else {
        setFormError(response.error || 'Unable to update card.');
      }
    } else {
      const response = await createCard(payload);
      if (response.success && response.data) {
        setCards((current) => [...current, response.data as CreditCard]);
        setFormMessage('Credit card added successfully.');
      } else {
        setFormError(response.error || 'Unable to add card.');
      }
    }

    setLoading(false);
    setForm(createEmptyForm());
    setEditingId(null);
  }

  function handleEdit(card: CreditCard) {
    setEditingId(card.id);
    setForm({
      name: card.name,
      balance: String(card.balance),
      minimumPayment: String(card.minimumPayment),
      apr: String(card.apr),
    });
    setFormError(null);
    setFormMessage(null);
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setFormError(null);
    setFormMessage(null);

    const response = await deleteCard(id);
    if (response.success) {
      setCards((current) => current.filter((card) => card.id !== id));
      setFormMessage(response.message || 'Card deleted successfully.');
      if (editingId === id) {
        setEditingId(null);
        setForm(createEmptyForm());
      }
    } else {
      setFormError(response.error || 'Unable to delete card.');
    }

    setLoading(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Credit Card Ledger</h2>
          <p style={styles.subtitle}>
            Track balances, minimum payments, and APRs for each card.
          </p>
        </div>
        <div style={styles.summaryBox}>
          <span style={styles.summaryLabel}>Total Balance</span>
          <strong style={styles.summaryValue}>
            ${totalBalance.toFixed(2)}
          </strong>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <h3 style={styles.formTitle}>{editingId ? 'Edit Card' : 'Add Card'}</h3>

        <label style={styles.label}>
          Card Name
          <input
            style={styles.input}
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Example: Sapphire Card"
            required
          />
        </label>

        <label style={styles.label}>
          Balance
          <input
            style={styles.input}
            type="number"
            step="0.01"
            value={form.balance}
            onChange={(e) => updateField('balance', e.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        <label style={styles.label}>
          Minimum Payment
          <input
            style={styles.input}
            type="number"
            step="0.01"
            value={form.minimumPayment}
            onChange={(e) => updateField('minimumPayment', e.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        <label style={styles.label}>
          Annual Percentage Rate (APR)
          <input
            style={styles.input}
            type="number"
            step="0.01"
            value={form.apr}
            onChange={(e) => updateField('apr', e.target.value)}
            placeholder="18.99"
            required
          />
        </label>

        <div style={styles.actions}>
          <button type="submit" style={styles.primaryButton} disabled={loading}>
            {editingId ? 'Save Changes' : 'Add Card'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(createEmptyForm());
                setFormError(null);
                setFormMessage(null);
              }}
              style={styles.secondaryButton}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {formMessage && <p style={styles.successText}>{formMessage}</p>}
        {formError && <p style={styles.errorText}>{formError}</p>}
      </form>

      <div style={styles.listSection}>
        {loading && cards.length === 0 ? (
          <p style={styles.emptyState}>Loading cards…</p>
        ) : cards.length === 0 ? (
          <p style={styles.emptyState}>No credit cards added yet.</p>
        ) : (
          cards.map((card) => (
            <div key={card.id} style={styles.cardItem}>
              <div>
                <h3 style={styles.cardName}>{card.name}</h3>
                <p style={styles.cardMeta}>
                  Balance: ${formatNumber(Number(card.balance))}
                </p>
                <p style={styles.cardMeta}>
                  Minimum Payment: ${formatNumber(Number(card.minimumPayment))}
                </p>
                <p style={styles.cardMeta}>
                  APR: {formatNumber(Number(card.apr))}%
                </p>
              </div>
              <div style={styles.cardActions}>
                <button
                  type="button"
                  onClick={() => handleEdit(card)}
                  style={styles.secondaryButton}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(card.id)}
                  style={styles.dangerButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
  },
  subtitle: {
    margin: '0.25rem 0 0',
    color: '#666',
  },
  summaryBox: {
    border: '1px solid #d8dce6',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    background: '#f8fafc',
    minWidth: '160px',
  },
  summaryLabel: {
    display: 'block',
    fontSize: '0.85rem',
    color: '#64748b',
  },
  summaryValue: {
    fontSize: '1.15rem',
    color: '#111827',
  },
  formCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '0.9rem',
    padding: '1rem',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  formTitle: {
    marginTop: 0,
    marginBottom: '0.75rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    marginBottom: '0.75rem',
    fontWeight: 600,
  },
  input: {
    padding: '0.65rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  primaryButton: {
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    padding: '0.65rem 1rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#111827',
    padding: '0.65rem 1rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
  },
  dangerButton: {
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    padding: '0.65rem 1rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
  },
  listSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  emptyState: {
    padding: '1rem',
    border: '1px dashed #cbd5e1',
    borderRadius: '0.75rem',
    color: '#64748b',
    background: '#f8fafc',
  },
  cardItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.9rem',
    padding: '1rem',
    background: '#fff',
  },
  cardName: {
    margin: '0 0 0.25rem',
  },
  cardMeta: {
    margin: '0.15rem 0',
    color: '#475569',
  },
  cardActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
};

export default CreditCardManager;
