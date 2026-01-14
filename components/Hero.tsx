
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";

interface HeroProps {
  isDirector: boolean;
  heading: string;
  setHeading: (val: string) => void;
  videoUrl: string;
  setVideoUrl: (val: string) => void;
}

const Hero: React.FC<HeroProps> = ({ isDirector, heading, setHeading, videoUrl, setVideoUrl }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isEditingHeading, setIsEditingHeading] = useState(false);
  const [tempHeading, setTempHeading] = useState(heading);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isImage, setIsImage] = useState(false);
  const [isYouTube, setIsYouTube] = useState(false);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const ytMatch = videoUrl.match(ytRegex);
    
    if (ytMatch) {
      setIsYouTube(true);
      setYoutubeId(ytMatch[1]);
      setIsImage(false);
      setIsPlaying(true);
    } else {
      setIsYouTube(false);
      const checkIsImage = videoUrl.startsWith('data:image/') || 
                           /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(videoUrl) ||
                           (!videoUrl.startsWith('data:video') && !videoUrl.includes('mp4') && !videoUrl.includes('raw/main'));
      setIsImage(checkIsImage);
      if (checkIsImage) setIsPlaying(true);
    }
  }, [videoUrl]);

  const forcePlay = useCallback(async () => {
    if (isImage || isYouTube) return;
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
        setIsPlaying(true);
      } catch (err) {
        console.log("Waiting for user gesture");
      }
    }
  }, [isImage, isYouTube]);

  useEffect(() => {
    forcePlay();
    const handleGesture = () => forcePlay();
    window.addEventListener('click', handleGesture, { once: true });
    return () => window.removeEventListener('click', handleGesture);
  }, [forcePlay, videoUrl]);

  const handleScrollToCollection = () => {
    const el = document.getElementById('collection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGenerateVideo = useCallback(async (useCurrentImage = false) => {
    if (isGenerating) return;
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) { await window.aistudio.openSelectKey(); return; }
    }
    setIsGenerating(true);
    setStatusMessage("모리가 아틀리에의 새로운 공기를 현상하고 있습니다...");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const config: any = {
        model: 'veo-3.1-fast-generate-preview',
        prompt: "Extreme high-end luxury fashion film, pure visual aesthetic, Hermes spirit, minimalist masterpiece, orange warm tones, cinematic 4k, strictly ABSOLUTELY NO TEXT on video, no letters, no logos, NO WATERMARK.",
        config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
      };

      if (useCurrentImage && videoUrl.startsWith('data:image/')) {
        const parts = videoUrl.split(',');
        config.image = { imageBytes: parts[1], mimeType: parts[0].split(';')[0].split(':')[1] };
      }

      let operation = await ai.models.generateVideos(config);
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }
      
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => { setVideoUrl(reader.result as string); setStatusMessage(""); };
        reader.readAsDataURL(blob);
      }
    } catch (error: any) {
      setStatusMessage("현상 프로세스 지연. 잠시 후 다시 시도해주세요.");
    } finally { setIsGenerating(false); }
  }, [isGenerating, videoUrl, setVideoUrl]);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#0a0a0a]">
      <input type="file" ref={videoInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => setVideoUrl(event.target?.result as string);
          reader.readAsDataURL(file);
        }
      }} className="hidden" accept="video/*,image/*" />
      
      {isYouTube && youtubeId ? (
        <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none bg-black">
          <iframe 
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1`}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[100%] min-h-[100%] w-[180vw] h-[180vh] md:w-[150vw] md:h-[150vh] transition-opacity duration-[2000ms]"
            style={{ objectFit: 'cover' }}
            allow="autoplay; encrypted-media; fullscreen"
            frameBorder="0"
          ></iframe>
          <div className="absolute inset-0 bg-black/10 z-[5]" />
        </div>
      ) : isImage ? (
        <div className="absolute inset-0 z-0">
          <img src={videoUrl} className="w-full h-full object-cover ken-burns opacity-100" />
        </div>
      ) : (
        <video 
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay muted loop playsInline preload="auto"
          className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-[2000ms] ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Cinematic Overlays */}
      <div className="film-grain" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.6)_100%)] z-10 pointer-events-none" />

      <div className="relative h-full z-20 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
        <div className="w-full max-w-5xl space-y-12">
          <div className="flex flex-col items-center gap-4 animate-fade-in-up">
            <div className="w-12 h-px bg-[#E35205] mb-2"></div>
            <span className="text-white/80 text-[10px] md:text-[12px] tracking-[2em] uppercase font-bold">L'Esprit de Nuku</span>
          </div>
          
          {isEditingHeading ? (
            <div className="pointer-events-auto bg-black/60 backdrop-blur-3xl p-10 rounded-sm border border-white/10 shadow-2xl">
              <textarea value={tempHeading} onChange={(e) => setTempHeading(e.target.value)} rows={2} className="bg-transparent text-white font-serif text-4xl md:text-8xl text-center outline-none w-full resize-none leading-tight" autoFocus />
              <div className="flex justify-center gap-6 mt-10">
                <button onClick={() => { setHeading(tempHeading); setIsEditingHeading(false); }} className="px-10 py-4 bg-[#E35205] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors">저장</button>
                <button onClick={() => setIsEditingHeading(false)} className="px-10 py-4 border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest">취소</button>
              </div>
            </div>
          ) : (
            <h2 onClick={() => isDirector && setIsEditingHeading(true)} className={`font-serif text-5xl md:text-[8rem] text-white leading-[1.15] tracking-tight pointer-events-auto transition-all duration-700 ${isDirector ? 'cursor-pointer hover:text-[#E35205] hover:scale-[1.02]' : ''}`}>
              {heading.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br/>}{l}</React.Fragment>)}
            </h2>
          )}

          <div className="flex flex-col gap-6 w-full max-w-sm mx-auto pointer-events-auto pt-16">
            <button 
              onClick={handleScrollToCollection}
              className="group relative overflow-hidden bg-white text-black py-6 text-[11px] tracking-[0.6em] font-bold uppercase transition-all shadow-2xl"
            >
              <span className="relative z-10">COLLECTION</span>
              <div className="absolute inset-0 bg-[#E35205] translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            </button>
            
            {isDirector && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleGenerateVideo(isImage)} 
                    disabled={isGenerating} 
                    className="flex-1 bg-black/40 backdrop-blur-md border border-white/20 text-white py-4 text-[9px] tracking-widest font-bold uppercase hover:bg-[#E35205] hover:border-[#E35205] transition-all"
                    title="시네마틱 아카이브를 새롭게 구성합니다"
                  >
                    {isGenerating ? 'DEVELOPING...' : 'RE-DEVELOP'}
                  </button>
                  <button 
                    onClick={() => videoInputRef.current?.click()} 
                    className="flex-1 border border-white/10 bg-white/5 text-white py-4 text-[9px] tracking-widest font-bold uppercase hover:bg-white/20 transition-all"
                    title="직접 소장한 영상이나 사진으로 변경합니다"
                  >
                    CHANGE FILM
                  </button>
                </div>
                <p className="text-white/30 text-[8px] tracking-[0.2em] uppercase font-bold">Director's Curating Tools</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[100] bg-[#E35205] px-10 py-4 rounded-full shadow-2xl animate-fade-in-up">
          <p className="text-[10px] tracking-[0.3em] text-white font-bold uppercase animate-pulse">{statusMessage}</p>
        </div>
      )}
    </section>
  );
};

export default Hero;
