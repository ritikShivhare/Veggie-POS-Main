import React from "react";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";

interface AIReportsViewProps {
  handleGenerateAIReport: () => Promise<void>;
  isGeneratingReport: boolean;
  reportError: string;
  aiReport: string;
}

export default function AIReportsView({
  handleGenerateAIReport,
  isGeneratingReport,
  reportError,
  aiReport
}: AIReportsViewProps) {
  return (
    <div className="h-full p-6 flex flex-col gap-6 overflow-y-auto bg-[#f8fafc]">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-6xl mx-auto w-full">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Gemini Real-Time Operational Audit
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Generate a smart, deep-dive business analysis of sales momentum, raw materials reorder matrix, and labor utility.
            </p>
          </div>
          
          <button
            onClick={handleGenerateAIReport}
            disabled={isGeneratingReport}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-2 whitespace-nowrap self-start cursor-pointer"
          >
            {isGeneratingReport ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Querying Gemini 3.5...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white/90" />
                <span>Trigger AI Diagnosis</span>
              </>
            )}
          </button>
        </div>

        {reportError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <span className="font-bold">System Warning:</span> {reportError}
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 min-h-[400px] shadow-inner">
          {isGeneratingReport ? (
            <div className="h-[350px] flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
              <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
              <div>
                <p className="font-semibold text-slate-600">Evaluating restaurant performance metrics...</p>
                <p className="text-xs text-slate-400 mt-1">Computing raw ingredient margins and staffing allocations with Gemini AI.</p>
              </div>
            </div>
          ) : aiReport ? (
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-sans text-sm">
              <MarkdownRenderer content={aiReport} />
            </div>
          ) : (
            <div className="h-[350px] flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <span className="text-5xl filter brightness-90 mb-4">📈</span>
              <h3 className="font-semibold text-slate-600 text-sm">No Audit Record Generated</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Click the "Trigger AI Diagnosis" button above. The system will compile active sales, shifts, and raw stock parameters, and call Gemini's advanced reasoning engine.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
