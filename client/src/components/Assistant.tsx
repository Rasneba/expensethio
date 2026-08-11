import { useState } from 'react';
import { getExpenses, getDashboard, Expense } from '../services/api';
import { fmtBirr } from '../utils/currency';

interface Msg {
  from: 'user' | 'bot';
  text: string;
}

async function answer(q: string): Promise<string> {
  const query = q.toLowerCase();
  const [expenses, dash] = await Promise.all([getExpenses(), getDashboard()]);

  const spentOn = (list: Expense[]) =>
    list
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + e.amount, 0);
  const earned = (list: Expense[]) =>
    list
      .filter((e) => e.type === 'income')
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

  if (/balance|left|saved|net/.test(query)) {
    return `Your balance is ${fmtBirr(dash.balance)} (${dash.balance >= 0 ? 'positive' : 'negative'}).`;
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
      '• "What is my balance?"\n' +
      '• "How much did I spend on Food & Dining?"\n' +
      '• "What is my top category?"'
    );
  }

  return 'Sorry, I did not understand that. Type "help" to see what I can do.';
}

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: 'Hi! I am your Money Assistant. Ask me about your spending, income, or balance.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m) => [...m, { from: 'user', text }]);
    setBusy(true);
    try {
      const reply = await answer(text);
      setMsgs((m) => [...m, { from: 'bot', text: reply }]);
    } catch {
      setMsgs((m) => [...m, { from: 'bot', text: 'Sorry, I could not reach the data. Try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card chat-card">
      <h2>Money Assistant</h2>
      <div className="chat-log">
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg ${m.from}`}>
            {m.text.split('\n').map((line, j) => (
              <div key={j}>{line}</div>
            ))}
          </div>
        ))}
        {busy && <div className="chat-msg bot">...</div>}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about your money..."
        />
        <button className="btn primary" onClick={send} disabled={busy}>Send</button>
      </div>
    </div>
  );
}
