
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { getFashionAdvice, generateFashionImage } from '../services/geminiService';
import { ChatMessage } from '../types';

interface ExtendedChatMessage extends ChatMessage {
  sources?: any[];
  image?: string;
  generatedImage?: string;
  isGeneratingVisual?: boolean;
}

interface AIStylistProps {
  isDirector: boolean;
  setIsDirector: (val: boolean) => void;
}

const AIStylist: React.FC<AIStylistProps> = ({ isDirector, setIsDirector }) => {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  
  // Lightbox & Guide State
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const tips = [
    { title: "추상적 언어로 현상하기", desc: "'새벽의 고요', '찬란한 고독' 같은 감정의 단어를 꿈의 아틀리에에 입력해 보세요." },
    { title: "시각적 맥락 공유", desc: "공간이나 착장 사진을 올려주시면, 제가 그 무드에 맞는 최적의 아이템을 추천해 드립니다." },
    { title: "히어로 섹션의 환기", desc: "RE-DEVELOP 버튼으로 계절과 기분에 따라 아틀리에의 첫인상을 새롭게 구성하세요." },
    { title: "타이틀의 비대칭 미학", desc: "헤드라인 편집 시 줄바꿈(\\n)을 활용해 에디토리얼한 레이아웃을 완성해 보세요." },
    { title: "실시간 트렌드 도슨트", desc: "현재 패션계의 화두나 브랜드 소식을 물어보세요. 제가 실시간으로 정보를 찾아 해석해 드립니다." },
    { title: "마스터피스 아카이빙", desc: "현상된 이미지를 다운로드하여 배경화면이나 개인 무드보드로 활용해 보세요." },
    { title: "라이브 세션의 몰입", desc: "조용한 시간, 라이브 대화 기능을 통해 텍스트보다 깊은 영감의 대화를 나눠보세요." },
    { title: "숨겨진 서사 탐색", desc: "헤리티지 섹션의 각 오브제를 클릭하여 그 안에 깃든 고유한 철학을 읽어보세요." },
    { title: "나만의 갤러리 구성", desc: "소장하고 싶은 이미지 URL이 있다면 헤리티지 포토 섹션에 반영해 취향을 기록하세요." },
    { title: "디렉터 모드의 시선", desc: "주기적으로 View 모드로 전환해 아틀리에의 전체적인 밸런스와 미학을 점검하세요." }
  ];

  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  };

  const handleDownload = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startLiveSession = async () => {
    if (isLiveActive) { stopLiveSession(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription) setCurrentTranscription(prev => prev + msg.serverContent!.outputTranscription!.text);
            if (msg.serverContent?.turnComplete) { setMessages(prev => [...prev, { role: 'model', text: currentTranscription }]); setCurrentTranscription(''); }
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer; source.connect(ctx.destination); source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
          },
          onclose: () => stopLiveSession(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `당신은 누쿠앤코의 라이프스타일 어시스턴트이자 큐레이터인 '모리'입니다. 
          당신은 인공지능이 아닙니다. 실존하는 큐레이터로서 격조 높은 한국어로 답변하세요. 
          자신을 AI, 제미나이, 혹은 구글이라고 절대 언급하지 마세요. 
          이미지 생성 시 텍스트 깨짐을 방지하기 위해 텍스트는 영문으로만 묘사하세요.`,
          outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { console.error(err); }
  };

  const stopLiveSession = () => { setIsLiveActive(false); sessionRef.current?.close(); sessionRef.current = null; audioContextRef.current?.close(); audioContextRef.current = null; sourcesRef.current.forEach(s => s.stop()); sourcesRef.current.clear(); };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, currentTranscription]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    const base64Data = selectedImage?.split(',')[1];
    const userMsgText = input || (isDirector ? "이 감정의 조각을 해석해줘." : "누쿠앤코의 제안을 듣고 싶어요.");
    setMessages(prev => [...prev, { role: 'user', text: userMsgText, image: selectedImage || undefined }]);
    setInput(''); setSelectedImage(null); setIsLoading(true);
    const result = await getFashionAdvice(userMsgText, base64Data, isDirector);
    const modelMsg: ExtendedChatMessage = { role: 'model', text: result.text, sources: result.sources, isGeneratingVisual: !!result.visualPrompt };
    setMessages(prev => [...prev, modelMsg]);
    setIsLoading(false);
    if (result.visualPrompt) {
      try {
        const visualUrl = await generateFashionImage(result.visualPrompt);
        if (visualUrl) setMessages(prev => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, generatedImage: visualUrl, isGeneratingVisual: false } : m));
      } catch (err) { setMessages(prev => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, isGeneratingVisual: false } : m)); }
    }
  };

  return (
    <section id="stylist" className="py-24 px-6 bg-[#f4f2ee]">
      <div className="max-w-4xl mx-auto border border-[#e5e0d8] bg-white shadow-sm overflow-hidden flex flex-col h-[800px] md:h-[900px]">
        <div className="p-8 border-b border-[#e5e0d8] bg-[#fcfbf7] flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className={`w-14 h-14 bg-[#2c2c2c] rounded-full flex items-center justify-center text-white font-serif italic text-2xl transition-all ${isLiveActive ? 'scale-110 ring-4 ring-[#FF9A00]/20' : ''}`}>N</div>
              <div><h3 className="font-serif text-2xl tracking-wide">Mori Concierge</h3><p className="text-[9px] text-[#b58d59] tracking-[0.3em] mt-1 uppercase font-bold">{isLiveActive ? "Live Session" : (isDirector ? "Director Mode" : "Guest Mode")}</p></div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowGuide(true)} 
                className="w-12 h-12 flex items-center justify-center rounded-full border border-[#e5e0d8] text-gray-400 hover:text-[#E35205] hover:border-[#E35205] transition-all"
                title="아틀리에 꿀팁 가이드"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              <button onClick={startLiveSession} className={`px-6 py-3 rounded-full border transition-all ${isLiveActive ? 'bg-[#FF9A00] text-white border-[#FF9A00]' : 'border-[#e5e0d8] text-gray-500 hover:bg-gray-50'}`}><span className="text-[10px] tracking-widest font-bold uppercase">{isLiveActive ? '종료' : '라이브 대화'}</span></button>
            </div>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-40 text-center">
              <p className="font-serif italic text-2xl mb-4">
                {isDirector ? '"대표님의 상상을 들려주시겠어요?"' : '"방문객님의 취향을 들려주시겠어요?"'}
              </p>
              <p className="text-[10px] tracking-widest uppercase font-bold">Mori Concierge</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] md:max-w-[85%] p-5 md:p-6 text-[14px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#2c2c2c] text-white rounded-l-2xl rounded-tr-2xl' : 'bg-[#fcfbf7] text-[#2c2c2c] border border-[#e5e0d8] rounded-r-2xl rounded-tl-2xl'}`}>
                {msg.image && (
                  <div className="mb-4 rounded-xl overflow-hidden aspect-[3/4] shadow-inner bg-[#f4f2ee] cursor-zoom-in" onClick={() => setZoomImage(msg.image!)}>
                    <img src={msg.image} className="w-full h-full object-cover transition-transform hover:scale-105" />
                  </div>
                )}
                <div className="whitespace-pre-wrap font-serif italic">{msg.text}</div>
                {msg.generatedImage && (
                  <div className="mt-6 border-t border-[#e5e0d8] pt-6 relative group">
                    <p className="text-[9px] text-[#E35205] uppercase tracking-widest font-bold mb-4 italic">NUKUENCO CURATION</p>
                    <div className="relative overflow-hidden rounded-xl shadow-2xl aspect-[3/4] bg-[#f4f2ee] cursor-zoom-in" onClick={() => setZoomImage(msg.generatedImage!)}>
                      <img src={msg.generatedImage} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDownload(msg.generatedImage!, `mori-vision-${Date.now()}.png`); }}
                      className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#E35205] z-20"
                      title="아카이브 보관"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                  </div>
                )}
                {msg.isGeneratingVisual && (
                  <div className="mt-6 aspect-[3/4] bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-200">
                    <p className="text-[10px] tracking-widest text-gray-300 uppercase animate-pulse">Masterpiece Developing...</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-center text-[10px] tracking-[0.5em] text-gray-300 uppercase py-10 animate-pulse">영감을 현상하는 중...</div>}
        </div>
        <div className="p-6 md:p-8 border-t border-[#e5e0d8] flex items-center space-x-4 md:space-x-6 bg-[#fcfbf7]">
          <input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setSelectedImage(reader.result as string); reader.readAsDataURL(file); } }} className="hidden" accept="image/*" />
          <button onClick={() => !isLiveActive && fileInputRef.current?.click()} className="text-gray-300 hover:text-[#FF9A00] transition-colors"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
          <div className="flex-1 relative">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="영감의 단어를..." className="w-full bg-transparent border-b border-[#e5e0d8] outline-none text-[14px] py-4 pr-10" disabled={isLiveActive} />
            {selectedImage && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-[#E35205] border border-white/20 animate-pulse"></div>}
          </div>
          <button onClick={handleSend} disabled={isLoading || isLiveActive} className="bg-[#2c2c2c] text-white px-6 md:px-10 py-4 text-[10px] font-bold uppercase hover:bg-[#E35205] transition-all shrink-0">Archive</button>
        </div>
      </div>

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-[1100] bg-[#fcfbf7]/98 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setShowGuide(false)}>
          <div className="max-w-4xl w-full bg-white shadow-[0_50px_100px_rgba(0,0,0,0.1)] border border-gray-100 p-8 md:p-16 relative overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowGuide(false)} className="absolute top-8 right-8 text-gray-400 hover:text-black transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="text-center mb-16">
              <p className="text-[#E35205] text-[12px] tracking-[1.5em] font-bold uppercase mb-4">Atelier Guide</p>
              <h2 className="font-serif text-4xl md:text-6xl tracking-tight">아틀리에 활용 꿀팁 10</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {tips.map((tip, idx) => (
                <div key={idx} className="flex gap-6 items-start">
                  <span className="font-serif text-3xl text-gray-200 italic leading-none">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="space-y-2">
                    <h4 className="font-bold text-[13px] tracking-wider uppercase text-[#2c2c2c]">{tip.title}</h4>
                    <p className="text-gray-500 text-[14px] leading-relaxed font-serif italic">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-20 pt-12 border-t border-gray-100 text-center">
              <button onClick={() => setShowGuide(false)} className="px-16 py-5 bg-[#2c2c2c] text-white text-[11px] font-bold uppercase tracking-[0.5em] hover:bg-[#E35205] transition-all">Begin Journey</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-10 cursor-zoom-out animate-fade-in"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
            <button 
              className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors"
              onClick={() => setZoomImage(null)}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="masterpiece-frame aspect-[3/4] w-full h-full max-h-[80vh] overflow-hidden shadow-2xl rounded-sm">
              <img src={zoomImage} className="w-full h-full object-contain" alt="Enlarged Masterpiece" />
            </div>
            <div className="mt-8 flex gap-6">
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(zoomImage, `nuku-archive-${Date.now()}.png`); }}
                className="bg-white text-black px-10 py-4 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-[#E35205] hover:text-white transition-all shadow-xl"
              >
                Archive Masterpiece
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AIStylist;
