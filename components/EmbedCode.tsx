'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function EmbedCode({ chatbotId }: { chatbotId: string }) {
  const [copied, setCopied] = useState(false);
  
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const scriptCode = `<!-- FoxAI Chat Widget -->
<script 
  src="${appUrl}/widget.js" 
  data-chatbot-id="${chatbotId}"
  async
></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
        <p className="text-sm text-emerald-800 leading-relaxed">
          Copy the code below and paste it into your website&apos;s <strong>&lt;body&gt;</strong> or <strong>&lt;head&gt;</strong> section.
        </p>
      </div>

      <div className="relative group">
        <pre className="p-6 bg-neutral-900 text-emerald-400 rounded-2xl overflow-x-auto font-mono text-sm leading-relaxed border border-neutral-800">
          {scriptCode}
        </pre>
        <button 
          onClick={copyToClipboard}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all backdrop-blur-md"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="space-y-4">
        <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-400">Instructions</h4>
        <ul className="space-y-3">
          {[
            'Works with WordPress, Shopify, Wix, and custom HTML.',
            'Updates to your bot are applied instantly without changing the code.',
            'Ensure you have configured your AI behavior before embedding.'
          ].map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-neutral-600">
              <div className="w-5 h-5 rounded-full bg-neutral-200 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                {i + 1}
              </div>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
