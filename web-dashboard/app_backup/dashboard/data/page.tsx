// app/dashboard/data/page.tsx
"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

export default function DataPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((d) => setItems(d.items))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function add() {
    if (!question.trim() || !answer.trim()) return;
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        answer,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      }),
    });
    setQuestion("");
    setAnswer("");
    setKeywords("");
    load();
  }

  async function remove(id: string) {
    await fetch("/api/knowledge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">إضافة معلومة جديدة</h2>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="السؤال"
          className="w-full border rounded-lg px-3 py-2"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="الإجابة"
          rows={3}
          className="w-full border rounded-lg px-3 py-2"
        />
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="كلمات مفتاحية (مفصولة بفاصلة)"
          className="w-full border rounded-lg px-3 py-2"
        />
        <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          إضافة
        </button>
      </div>

      {loading ? (
        <p>جاري التحميل...</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 flex justify-between">
              <div>
                <p className="font-medium">{item.question}</p>
                <p className="text-sm text-gray-600">{item.answer}</p>
              </div>
              <button onClick={() => remove(item.id)} className="text-red-500 text-sm">
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
