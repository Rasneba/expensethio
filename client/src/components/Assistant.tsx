import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getExpenses, getDashboard, Expense } from '../services/api';
import { fmtBirr } from '../utils/currency';

interface Msg {
  from: 'user' | 'bot';
  text: string;
}

const SUGGESTIONS = [
  'How much did I spend?',
  'What is my balance?',
  'How much do I owe?',
  'Top category',
  'How much did I earn?',
  'Help',
];

async function answer(q: string): Promise<string> {
  const query = q.toLowerCase();
  const [expenses, dash] = await Promise.all([getExpenses(), getDashboard()]);

  const spentOn = (list: Expense[]) =>
    list
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + e.amount, 0);

  if (/spend|spent|expense/.test(query)) {
    const month = /month/.test(query);
    const total = month ? dash.monthExpense : dash.expenseTotal;
    return month
      ? `You spent ${fmtBirr(total)} this month.`
      : `You have spent ${fmtBirr(total)} in total.`;
  }

  if (/earn|income|salary|made|receive/.test(query)) {
    const month = /month/.test(query);
    const total = month ? dash.monthIncome : dash.incomeTotal;
    return month
      ? `You earned ${fmtBirr(total)} this month.`
      : `You have earned ${fmtBirr(total)} in total.`;
  }

  if (/balance|left|saved|net|available/.test(query)) {
    return `Your available balance is ${fmtBirr(dash.availableBalance)} (${dash.availableBalance >= 0 ? 'positive' : 'negative'}).\nThis is calculated as: Income (${fmtBirr(dash.incomeTotal)}) + Borrowed (${fmtBirr(dash.creditBorrowed)}) − Expenses (${fmtBirr(dash.expenseTotal)}) − Credit Payments (${fmtBirr(dash.creditPayments)}).`;
  }

  if (/credit|owe|owed|borrow|loan|liability/.test(query)) {
    return `Credit Summary:\n• Total borrowed: ${fmtBirr(dash.creditBorrowed)}\n• Payments made: ${fmtBirr(dash.creditPayments)}\n• Outstanding owed: ${fmtBirr(dash.creditOwed)}`;
  }

  if (/count|how many|number of|transactions/.test(query)) {
    return `You have ${dash.count} transaction${dash.count === 1 ? '' : 's'} recorded.`;
  }

  const catMatch = expenses.find((e) =>
    query.includes(e.category.toLowerCase().split(' ')[0])
  );
  if (catMatch && /on |spend on|for |category|how much/.test(query)) {
    const cat = catMatch.category;
    const total = spentOn(expenses.filter((e) => e.category === cat));
    return `You've spent ${fmtBirr(total)} on ${cat}.`;
  }

  if (/top|biggest|largest|most/.test(query) && /category|spending|expense/.test(query)) {
    if (dash.byCategory.length === 0) return 'No expense categories yet.';
    const top = dash.byCategory[0];
    const pct = dash.expenseTotal > 0 ? Math.round((top.total / dash.expenseTotal) * 100) : 0;
    return `Your top spending category is ${top.category} at ${fmtBirr(top.total)} (${pct}% of expenses).`;
  }

  if (/this month|monthly|this month's/.test(query) && /top|biggest|most/.test(query)) {
    const monthExpenses = expenses.filter(
      (e) =>
        e.type === 'expense' &&
        e.date.slice(0, 7) === new Date().toISOString().slice(0, 7)
    );
    const byCat = new Map<string, number>();
    monthExpenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount));
    if (byCat.size === 0) return 'No expenses recorded this month yet.';
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
    return `Your top category this month is ${top[0]} at ${fmtBirr(top[1])}.`;
  }

  if (/help|what can|do you|\/?$/.test(query) || query.trim() === '') {
    return (
      'I can answer questions about your money. Try:\n' +
      '• "How much did I spend?"\n' +
      '• "How much did I earn this month?"\n' +
      '• "What is my available balance?"\n' +
      '• "How much do I owe?"\n' +
      '• "How much did I spend on Food & Dining?"\n' +
      '• "What is my top category?"'
    );
  }

  return 'Sorry, I did not understand that. Type "help" to see what I can do.';
}

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: 'Hi! 👋 I\'m your Money Assistant. Ask me about your spending, income, or balance.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [msgs, busy]);

  const send = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput('');
    setMsgs((m) => [...m, { from: 'user', text: q }]);
    setBusy(true);
    try {
      const reply = await answer(q);
      setMsgs((m) => [...m, { from: 'bot', text: reply }]);
    } catch {
      setMsgs((m) => [...m, { from: 'bot', text: 'Sorry, I could not reach the data. Try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card chat-card">
      <h2>🤖 Money Assistant</h2>
      <div className="chat-log" ref={logRef}>
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div
              key={i}
              className={`chat-msg ${m.from}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              {m.text.split('\n').map((line, j) => (
                <div key={j}>{line}</div>
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <motion.div
            className="chat-msg bot"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="typing-indicator">
              <span />
              <span />
              <span />
            </div>
          </motion.div>
        )}
      </div>
      {msgs.length <= 1 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <motion.button
              key={s}
              className="chat-suggestion"
              onClick={() => send(s)}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about your money..."
          disabled={busy}
        />
        <motion.button
          className="btn primary"
          onClick={() => send()}
          disabled={busy || !input.trim()}
          whileTap={{ scale: 0.95 }}
        >
          Send
        </motion.button>
      </div>
    </div>
  );
}
