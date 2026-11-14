import React, { useState } from 'react';
import { X, RotateCw, Eye, Share2, FileText, Sparkles } from 'lucide-react';

export default function HandoutInspectorModal({
  handout,
  onClose,
  role,
  onShareWithPlayers,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  if (!handout) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 select-none animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Side: Interactive 3D Flippable High-Resolution Document Artifact */}
        <div className="flex-1 p-6 bg-gradient-to-b from-zinc-900/90 to-zinc-950 flex flex-col items-center justify-center relative min-h-[380px]">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400/90 mb-3 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Modo de Inspeção 3D • {isFlipped ? 'VERSO DO OBJETO' : 'FRENTE DO OBJETO'}
          </div>

          {/* 3D Flippable Card Container */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full max-w-md h-72 cursor-pointer perspective-1000"
            title="Clique para virar o documento (Frente / Verso)"
          >
            <div
              className={`relative w-full h-full rounded-xl transition-transform duration-700 transform-style-3d shadow-2xl ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* FRONT FACE */}
              <div className="absolute inset-0 backface-hidden rounded-xl p-6 flex flex-col justify-between bg-[#f3ead8] text-zinc-900 border-2 border-amber-900/60 shadow-inner">
                <div>
                  <div className="flex items-center justify-between border-b border-amber-900/30 pb-2 mb-3">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-900">
                      {handout.frontHeader}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {handout.frontDate}
                    </span>
                  </div>
                  <p className="font-serif text-sm leading-relaxed text-zinc-900 italic">
                    {handout.frontBody}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-amber-900/20 text-[10px] font-mono text-zinc-700">
                  <span>ARQUIVO FÍSICO • ORDO REALITAS</span>
                  <span className="text-red-800 font-bold">CLIQUE PARA VIRAR ↻</span>
                </div>
              </div>

              {/* BACK FACE (Rotated 180 deg) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl p-6 flex flex-col justify-between bg-[#1c1613] text-amber-100 border-2 border-red-700/70 shadow-inner">
                <div>
                  <div className="flex items-center justify-between border-b border-red-800/40 pb-2 mb-3">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {handout.backTitle}
                    </span>
                  </div>
                  <p className="font-mono text-xs leading-relaxed text-amber-200 whitespace-pre-line bg-red-950/40 p-3 rounded-lg border border-red-800/50">
                    {handout.backSecret}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-[10px] font-mono text-red-400">
                  <span>{handout.backStamp}</span>
                  <span>CLIQUE PARA DESVIRAR ↺</span>
                </div>
              </div>
            </div>
          </div>

          {/* Flip & Action Controls below 3D Card */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Virar Documento ({isFlipped ? 'Ver Frente' : 'Ler Verso Oculto'})
            </button>

            {role === 'gm' && (
              <button
                onClick={() => onShareWithPlayers(handout)}
                className="px-3.5 py-1.5 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-100 border border-red-500/60 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                Revelar na Tela de Todos
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Readable Transcription & Metadata */}
        <div className="w-full md:w-80 p-5 bg-zinc-950 border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                  Evidência Inspecionada
                </span>
                <h3 className="font-serif text-base font-bold text-zinc-100 mt-0.5">
                  {handout.title}
                </h3>
                <p className="text-[11px] text-zinc-400">{handout.subtitle}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Transcrição de Texto
              </span>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-[10px] text-amber-400 hover:underline"
              >
                {showTranscript ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {showTranscript && (
              <div className="space-y-3 text-xs text-zinc-300 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 max-h-60 overflow-y-auto">
                <div>
                  <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase mb-1">
                    [Frente do Documento]
                  </div>
                  <p className="leading-relaxed">{handout.frontBody}</p>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <div className="text-[10px] font-mono font-bold text-red-400 uppercase mb-1">
                    [Verso / Anotação Secreta]
                  </div>
                  <p className="leading-relaxed text-amber-200/90 font-mono text-[11px]">
                    {handout.backSecret}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-800 flex justify-end">
            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-100 transition"
            >
              Fechar Inspeção (Esc / Espaço)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
