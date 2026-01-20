
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AIStylist from './components/AIStylist';
import { PRODUCTS as INITIAL_PRODUCTS } from './constants';
import { generateFashionImage, getApiKeyStatus } from './services/geminiService';
import { Product } from './types';

interface ExtendedProduct extends Product {
  isUserPhoto?: boolean;
}

interface WeeklyObject {
  title: string;
  subtitle: string;
  description: string;
  image: string;
}

interface HeritageInfo {
  image: string;
  title: string;
  description: string;
}

// STORAGE_KEY v89: 제품 상세 닫기 버튼 UI 개선 (Close Entry)
const STORAGE_KEY = 'nukuenco_atelier_v89_close_entry_update';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_MOON_JAR = "https://raw.githubusercontent.com/267nuku/nukuenco_test/main/images/nuku-masterpiece%20(3).png";
const DEFAULT_VIDEO = "https://github.com/267nuku/nukuenco_test/raw/main/%EB%8B%AC%EB%A6%AC%EB%8A%94_%EC%98%81%EC%83%81_%EC%83%9D%EC%84%B1_%EC%99%84%EB%A3%8C.mp4";

const DEFAULT_HERITAGE_DATA: HeritageInfo[] = [
  {
    image: "https://raw.githubusercontent.com/267nuku/nukuenco_test/main/images/unnamed%20(76).jpg",
    title: "차가운 공간, 뜨거운 시선",
    description: "모든 것이 멈춘 듯한 회랑의 침묵 속에서 시선을 사로잡는 단 하나의 붉은 존재감.\n\n냉정과 열정 사이, 당신의 심장 가장 가까운 곳에서 빛날 에너지입니다."
  },
  {
    image: "https://raw.githubusercontent.com/267nuku/nukuenco_test/main/images/nuku-masterpiece-1767596172918.png",
    title: "정적의 층위",
    description: "겹겹이 쌓인 질감 사이로 흐르는 무언의 약속.\n우리는 가장 완벽한 불완전함 속에서\n진정한 고귀함을 발견하곤 합니다."
  },
  {
    image: "https://raw.githubusercontent.com/267nuku/nukuenco_test/main/images/nuku-masterpiece-1767582838273.png",
    title: "정제된 몰입의 기록",
    description: "수많은 선들이 모여 하나의 곡선이 되고, 수백 번의 고민이 모여 당신의 취향이 됩니다.\n\n화려한 결과물 뒤에 숨겨진, 가장 치열하고도 고요한 창작의 여정.\n\nWelcome to NUKU's Atelier"
  },
  {
    image: "https://raw.githubusercontent.com/267nuku/nukuenco_test/main/images/nuku-masterpiece-1767580371913.png",
    title: "본질의 투영",
    description: "불필요한 모든 것을 걷어낸 후에야 비로소 드러나는 것.\n나를 투영하는 사물은\n가장 낮은 목소리로 가장 깊은 위로를 건냅니다."
  }
];

const resizeMediaForStorage = (base64Str: string, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    if (base64Str.startsWith('data:video') || base64Str.includes('youtube.com') || base64Str.includes('youtu.be')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onerror = () => resolve(base64Str);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;
      if (width > height) { if (width > maxDim) { height *= maxDim / width; width = maxDim; } }
      else { if (height > maxDim) { width *= maxDim / height; height = maxDim; } }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

const App: React.FC = () => {
  const [showEntryGate, setShowEntryGate] = useState(true);
  const [products, setProducts] = useState<ExtendedProduct[]>(INITIAL_PRODUCTS);
  const [heroHeading, setHeroHeading] = useState("작은사치\n그 아름다운 여정");
  const [heroVideo, setHeroVideo] = useState(DEFAULT_VIDEO);
  const [heritageData, setHeritageData] = useState<HeritageInfo[]>(DEFAULT_HERITAGE_DATA);
  const [weeklyObject, setWeeklyObject] = useState<WeeklyObject>({
    title: "달항아리",
    subtitle: "Moon Jar: White Porcelain",
    description: '"비어있음으로 채워지는 미학.\n인위적인 기교를 걷어낸 순백의 곡선은\n우리가 추구하는 삶의 태도를 대변합니다."',
    image: DEFAULT_MOON_JAR
  });
  
  const [dreamInput, setDreamInput] = useState("");
  const [dreamImage, setDreamImage] = useState<string | null>(null);
  const [isDreamLoading, setIsDreamLoading] = useState(false);
  const [dreamStatus, setDreamStatus] = useState("");

  const [isLoaded, setIsLoaded] = useState(false);
  const [isDirector, setIsDirector] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ExtendedProduct | null>(null);
  
  const heritageInputRef = useRef<HTMLInputElement>(null);
  const moonJarInputRef = useRef<HTMLInputElement>(null);
  
  const [activeHeritageIdx, setActiveHeritageIdx] = useState<number | null>(null);
  const [selectedHeritageDetail, setSelectedHeritageDetail] = useState<HeritageInfo | null>(null);
  const [editingHeritageIdx, setEditingHeritageIdx] = useState<number | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleHeritageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeHeritageIdx !== null) {
      setIsSaving(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const compressed = await resizeMediaForStorage(event.target?.result as string);
        const newData = [...heritageData];
        newData[activeHeritageIdx].image = compressed;
        setHeritageData(newData);
        showToast("헤리티지가 기록되었습니다.");
        setActiveHeritageIdx(null);
        setTimeout(() => setIsSaving(false), 800);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveHeritageText = (idx: number, title: string, desc: string) => {
    const newData = [...heritageData];
    newData[idx] = { ...newData[idx], title, description: desc };
    setHeritageData(newData);
    setEditingHeritageIdx(null);
    showToast("이야기가 새롭게 새겨졌습니다.");
  };

  const handleMoonJarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsSaving(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const compressed = await resizeMediaForStorage(event.target?.result as string);
        setWeeklyObject(prev => ({ ...prev, image: compressed }));
        showToast("마스터피스가 새롭게 현상되었습니다.");
        setTimeout(() => setIsSaving(false), 800);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMoonJarUrlPrompt = () => {
    const url = prompt("이미지 주소(URL)를 입력해 주세요:", weeklyObject.image);
    if (url && url.trim() !== "") {
      setWeeklyObject(prev => ({ ...prev, image: url.trim() }));
      showToast("이미지가 성공적으로 반영되었습니다.");
    }
  };

  const handleDownload = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("마스터피스가 아카이브되었습니다.");
  };

  const refreshReveal = useCallback(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { 
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }, []);

  const handleEnterAtelier = async () => {
    setShowEntryGate(false);
    setTimeout(refreshReveal, 300);
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setProducts(INITIAL_PRODUCTS);
        setHeroHeading(data.heroHeading || "작은사치\n그 아름다운 여정");
        setHeroVideo(data.heroVideo || DEFAULT_VIDEO);
        if (data.heritageData) setHeritageData(data.heritageData);
        if (data.weeklyObject) setWeeklyObject(data.weeklyObject);
        if (data.dreamImage) setDreamImage(data.dreamImage);
      } catch (e) { 
        setProducts(INITIAL_PRODUCTS); 
      }
    } else { 
      setProducts(INITIAL_PRODUCTS); 
      setWeeklyObject(prev => ({ ...prev, image: DEFAULT_MOON_JAR }));
    }
    
    // API 키 로드 상태 로깅
    const apiStatus = getApiKeyStatus();
    console.log('🎨 Mori Concierge API Status:', apiStatus);
    if (!apiStatus.available) {
      console.warn('⚠️ ', apiStatus.message);
    }
    
    setIsLoaded(true);
    refreshReveal();
  }, [refreshReveal, showToast]);

  useEffect(() => {
    if (isLoaded && !showEntryGate) {
      setIsSaving(true);
      const dataToSave = { products, heroHeading, heroVideo, heritageData, weeklyObject, dreamImage };
      try { 
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave)); 
        setTimeout(() => setIsSaving(false), 500);
      } catch (e) { setIsSaving(false); }
    }
  }, [products, heroHeading, heroVideo, heritageData, weeklyObject, dreamImage, isLoaded, showEntryGate]);

  const handleGenerateDream = async () => {
    if (!dreamInput.trim() || isDreamLoading) return;
    setIsDreamLoading(true);
    
    // 대표님 제안 반영: 접속 모드에 따른 가변 메시지 설정
    const loadingMessage = isDirector 
      ? "대표님의 상상을 현상하는 중..." 
      : "고객님의 상상을 현상하는 중...";
    setDreamStatus(loadingMessage);

    try {
      const url = await generateFashionImage(dreamInput);
      if (url) {
        const compressed = await resizeMediaForStorage(url);
        setDreamImage(compressed);
        showToast("마스터피스가 탄생했습니다.");
      }
    } catch (e: any) {
      showToast("현상 오류.");
    } finally {
      setIsDreamLoading(false);
      setDreamStatus("");
      setDreamInput("");
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbf7]">
      {showEntryGate && (
        <div className="fixed inset-0 z-[1000] bg-[#fcfbf7] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full animate-fade-in-up">
            <h1 className="font-serif text-3xl md:text-5xl tracking-[0.6em] font-bold text-[#2c2c2c] mb-4">NUKUENCO</h1>
            <p className="text-[9px] md:text-[11px] tracking-[0.8em] text-[#E35205] uppercase font-bold mb-20">L'Esprit du Luxe</p>
            <button onClick={handleEnterAtelier} className="group relative px-12 py-5 border border-[#2c2c2c] hover:bg-[#E35205] hover:border-[#E35205] transition-all duration-500">
              <span className="relative z-10 text-[10px] md:text-[12px] tracking-[1em] font-bold text-[#2c2c2c] group-hover:text-white transition-colors duration-500 uppercase">Discover</span>
            </button>
          </div>
        </div>
      )}

      <Navbar isDirector={isDirector} setIsDirector={setIsDirector} isSaving={isSaving} />
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-fade-in-up">
          <div className="bg-[#E35205] text-white px-8 py-4 rounded-full text-[10px] tracking-[0.2em] font-bold uppercase shadow-2xl">{toastMessage}</div>
        </div>
      )}

      <input type="file" ref={heritageInputRef} className="hidden" accept="image/*" onChange={handleHeritageChange} />
      <input type="file" ref={moonJarInputRef} className="hidden" accept="image/*" onChange={handleMoonJarChange} />

      <main className={`transition-opacity duration-1000 ${showEntryGate ? 'opacity-0' : 'opacity-100'}`}>
        <div id="hero">
          <Hero isDirector={isDirector} heading={heroHeading} setHeading={setHeroHeading} videoUrl={heroVideo} setVideoUrl={(url) => setHeroVideo(url)} />
        </div>
        
        <section id="collection" className="py-20 md:py-48 bg-white reveal">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-start justify-between mb-24 gap-12">
              <div className="max-w-4xl text-black">
                <div className="flex flex-col gap-4 mb-12">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-px bg-[#E35205]"></div>
                    <h3 className="text-[#E35205] text-[11px] tracking-[1em] font-bold uppercase">Objets d'Emotion</h3>
                  </div>
                  <p className="text-[#E35205] text-[10px] tracking-[0.3em] font-bold uppercase ml-[72px]">감정의 오브제 컬렉션</p>
                </div>
                
                <h2 className="font-serif text-3xl md:text-7xl leading-tight mb-12">
                  나의 사소한 취향들이 모여,<br/>
                  <span className="italic font-normal text-gray-300">비로소 내가 된다</span>
                </h2>
                
                <div className="space-y-10">
                  <p className="text-gray-500 font-serif italic text-lg md:text-2xl leading-relaxed max-w-3xl">
                    "남들의 시선보다 중요한 건 오늘 내가 나를 얼마나 귀하게 대접했는가입니다. <br/>
                    당신의 취향이 머무는 모든 순간이 나를 사랑하는 가장 멋진 의식이 되기를."
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-40">
              {products.map((product) => (
                <div key={product.id} className="group relative flex flex-col reveal" onClick={() => setSelectedProduct(product)}>
                  <div className="masterpiece-frame aspect-[4/5] mb-10 bg-[#f4f2ee] shadow-sm cursor-pointer">
                    <img src={product.image || FALLBACK_IMAGE} className="w-full h-full object-cover group-hover:scale-[1.25]" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-serif text-2xl md:text-3xl text-[#2c2c2c]">{product.name}</h4>
                    {product.subtitle && (
                      <p className="text-[12px] md:text-[14px] text-gray-500 font-normal leading-relaxed">{product.subtitle}</p>
                    )}
                    <p className="text-[9px] md:text-[10px] tracking-[0.3em] text-[#E35205] font-bold uppercase pt-1">{product.category}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-48 flex flex-col items-center text-center reveal">
              <div className="w-px h-24 bg-gradient-to-b from-transparent to-[#E35205]/30 mb-12"></div>
              <p className="text-[10px] tracking-[1.2em] text-[#E35205] font-bold uppercase mb-8 ml-4">Ritual Communication</p>
              <h3 className="font-serif text-3xl md:text-5xl text-[#2c2c2c] mb-12 italic">당신의 사적인 취향을<br/>들려주세요</h3>
              <a 
                href="http://pf.kakao.com/_xexaUxon/chat" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative px-20 py-6 border border-[#2c2c2c]/10 hover:border-[#E35205] transition-all duration-700 overflow-hidden"
              >
                <div className="absolute inset-0 bg-[#E35205] translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-in-out"></div>
                <span className="relative z-10 text-[11px] tracking-[0.6em] font-bold uppercase text-[#2c2c2c] group-hover:text-white transition-colors duration-700">Kakaotalk Consultation</span>
              </a>
              <p className="mt-8 text-[9px] text-gray-300 tracking-[0.3em] uppercase">Private & Exclusive Concierge</p>
            </div>
          </div>
        </section>

        <section id="heritage" className="py-32 md:py-64 bg-[#fcfbf7] reveal">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-20 items-center">
            <div className="lg:col-span-5">
              <div className="flex flex-col gap-4 mb-16">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-px bg-[#E35205]"></div>
                  <h3 className="text-[#E35205] text-[11px] tracking-[1em] font-bold uppercase">Espace et Senteur</h3>
                </div>
                <p className="text-[#E35205] text-[10px] tracking-[0.3em] font-bold uppercase ml-[72px]">공간과 향기 에디션</p>
              </div>
              
              <div className="space-y-8">
                <p className="text-3xl md:text-5xl font-serif italic text-gray-400 leading-tight">"L'Ame des Objets :<br/>사물의 영혼"</p>
                <div className="w-10 h-px bg-gray-200"></div>
                <p className="text-gray-500 font-serif italic text-lg md:text-xl max-w-sm leading-relaxed">
                  우리는 눈에 보이는 형태보다 그 안에 깃든 고요한 파동과 공간을 채우는 향의 기억에 집중합니다.
                </p>
              </div>
            </div>
            <div className="lg:col-span-7 grid grid-cols-2 gap-10">
              {heritageData.map((item, idx) => (
                <div key={idx} className={`relative group ${idx % 2 === 0 ? 'pt-20' : ''}`}>
                  <div className="masterpiece-frame aspect-[3/4] bg-[#f4f2ee] shadow-2xl cursor-pointer" onClick={() => setSelectedHeritageDetail(item)}>
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-[1.35]" />
                    {isDirector && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20">
                        <button onClick={(e) => { e.stopPropagation(); setActiveHeritageIdx(idx); heritageInputRef.current?.click(); }} className="bg-white text-black px-4 py-2 text-[8px] font-bold uppercase tracking-widest">Image</button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingHeritageIdx(idx); }} className="bg-black text-white px-4 py-2 text-[8px] font-bold uppercase tracking-widest border border-white/20">Story</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {editingHeritageIdx !== null && (
          <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white max-w-lg w-full p-10 space-y-8 shadow-2xl rounded-sm">
              <h3 className="font-serif text-2xl tracking-widest border-b border-gray-100 pb-4">Edit Heritage Story</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] tracking-widest uppercase font-bold text-gray-400 block mb-2">Title</label>
                  <input id="edit-h-title" type="text" defaultValue={heritageData[editingHeritageIdx].title} className="w-full border-b border-gray-200 py-2 outline-none focus:border-[#E35205] font-serif italic text-lg" />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest uppercase font-bold text-gray-400 block mb-2">Description</label>
                  <textarea id="edit-h-desc" defaultValue={heritageData[editingHeritageIdx].description} rows={5} className="w-full border border-gray-100 p-4 outline-none focus:border-[#E35205] font-serif italic text-sm resize-none" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => handleSaveHeritageText(editingHeritageIdx, (document.getElementById('edit-h-title') as HTMLInputElement).value, (document.getElementById('edit-h-desc') as HTMLTextAreaElement).value)} className="flex-1 bg-[#E35205] text-white py-4 text-[10px] font-bold uppercase tracking-widest">저장</button>
                <button onClick={() => setEditingHeritageIdx(null)} className="flex-1 border border-gray-200 py-4 text-[10px] font-bold uppercase tracking-widest">취소</button>
              </div>
            </div>
          </div>
        )}

        <section id="phenomenon" className="py-32 md:py-64 bg-[#050505] text-white reveal overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
            <div className="text-center mb-24">
              <span className="text-[#E35205] text-[11px] tracking-[1.5em] font-bold uppercase block mb-4">Dream Atelier</span>
              <h2 className="font-serif text-5xl md:text-8xl mb-8">현상의 아틀리에</h2>
              <div className="flex flex-wrap justify-center gap-4 mt-6">
                {["Cinematic 35mm", "Mandarin Glow", "Minimal Narrative", "Editorial Textures"].map(tag => (
                   <span key={tag} className="text-[8px] tracking-[0.3em] border border-white/20 px-3 py-1 uppercase opacity-40 hover:opacity-100 transition-opacity cursor-default">{tag}</span>
                ))}
              </div>
            </div>
            
            <div className="max-w-3xl w-full mb-20 relative">
              <input type="text" value={dreamInput} onChange={(e) => setDreamInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleGenerateDream()} placeholder="영감의 단어들을 나열해 주세요" className="w-full bg-transparent border-b border-white/10 py-8 text-2xl md:text-4xl font-serif italic text-white outline-none focus:border-[#E35205] transition-all text-center placeholder:text-white/5" />
              <button onClick={handleGenerateDream} disabled={isDreamLoading} className={`mt-12 mx-auto block px-16 py-6 bg-white text-black text-[10px] font-bold uppercase tracking-[0.5em] hover:bg-[#E35205] hover:text-white transition-all ${isDreamLoading ? 'opacity-30' : 'cursor-pointer'}`}>
                {isDreamLoading ? 'DEVELOPING...' : '마스터피스 현상하기'}
              </button>
            </div>

            <div className="max-w-4xl w-full min-h-[600px] flex items-center justify-center relative">
              {isDreamLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                   <p className="text-[12px] tracking-[0.8em] text-[#E35205] uppercase font-bold animate-pulse">{dreamStatus}</p>
                </div>
              )}
              {dreamImage ? (
                <div className="masterpiece-frame aspect-[3/4] w-full max-w-lg overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] group relative">
                  <img src={dreamImage} className="w-full h-full object-cover animate-fade-in" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <button onClick={() => handleDownload(dreamImage, `nuku-masterpiece.png`)} className="bg-white text-black px-10 py-4 text-[10px] font-bold uppercase tracking-widest">Archive</button>
                  </div>
                </div>
              ) : !isDreamLoading && (
                <div className="border border-white/5 aspect-[3/4] w-full max-w-lg flex flex-col items-center justify-center text-white/10">
                  <p className="font-serif italic text-2xl">Ready for your vision</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="moonjar-section" className="bg-[#fcfbf7] py-32 md:py-64 px-6 border-b border-[#f4f2ee] reveal">
          <div className="max-w-5xl mx-auto flex flex-col items-center">
            <div className="mb-16 w-full max-w-4xl flex justify-center">
              <div className="masterpiece-frame p-3 md:p-8 bg-white shadow-[0_60px_130px_-30px_rgba(0,0,0,0.12)] border border-gray-100 rounded-[2px] overflow-hidden group">
                <img src={weeklyObject.image} className="w-full h-auto max-h-[80vh] object-contain group-hover:scale-[1.25]" alt="Nukuenco Masterpiece" style={{ display: 'block' }} loading="eager" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                {isDirector && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 z-20">
                    <button onClick={() => moonJarInputRef.current?.click()} className="bg-white text-black px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E35205] shadow-xl">사진 업로드</button>
                    <button onClick={handleMoonJarUrlPrompt} className="bg-black text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest border border-white/20 shadow-xl">URL 입력</button>
                  </div>
                )}
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.02)]"></div>
              </div>
            </div>
            <div className="text-center space-y-10">
              <span className="text-[#E35205] text-[12px] tracking-[1.2em] font-bold uppercase block border-y border-[#E35205]/10 py-5">The Heritage Photo</span>
              <h2 className="font-serif text-[#2c2c2c] text-5xl md:text-[11rem] leading-none tracking-tighter">{weeklyObject.title}</h2>
              <p className="text-gray-400 text-xl md:text-3xl leading-[2.5] font-serif italic max-w-4xl mx-auto whitespace-pre-wrap">{weeklyObject.description}</p>
            </div>
          </div>
        </section>

        <AIStylist isDirector={isDirector} setIsDirector={setIsDirector} />
      </main>

      {selectedHeritageDetail && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-3xl overflow-y-auto" onClick={() => setSelectedHeritageDetail(null)}>
          <div className="min-h-screen flex items-center justify-center p-6 md:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 max-w-7xl w-full items-center bg-transparent" onClick={e => e.stopPropagation()}>
              <div className="masterpiece-frame aspect-[3/4] overflow-hidden shadow-2xl rounded-sm">
                <img src={selectedHeritageDetail.image} className="w-full h-full object-cover scale-[1.2]" />
              </div>
              <div className="text-left space-y-6 md:space-y-8 text-white py-8">
                <h3 className="font-serif text-4xl md:text-6xl lg:text-8xl leading-tight">{selectedHeritageDetail.title}</h3>
                <div className="w-12 h-px bg-[#E35205]"></div>
                <p className="text-white/60 text-lg md:text-2xl lg:text-3xl font-serif italic leading-relaxed whitespace-pre-wrap max-h-[40vh] lg:max-h-none overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/20">
                  {selectedHeritageDetail.description}
                </p>
                <button onClick={() => setSelectedHeritageDetail(null)} className="mt-8 px-10 py-4 border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">Close Entry</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-[200] bg-[#fcfbf7] flex flex-col overflow-y-auto animate-fade-in-up">
          <div className="max-w-5xl mx-auto w-full px-6 py-20 space-y-24 flex flex-col items-center">
            <div className="masterpiece-frame w-full aspect-[4/5] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-[#f4f2ee]">
              <img src={selectedProduct.image} className="w-full h-full object-cover scale-[1.15]" alt={selectedProduct.name} />
            </div>
            <div className="text-center space-y-10 py-10 border-y border-gray-100 w-full">
              <div className="space-y-4">
                <p className="text-[#E35205] text-[12px] tracking-[1.5em] font-bold uppercase">{selectedProduct.category}</p>
                <h2 className="font-serif text-5xl md:text-[7rem] tracking-tighter leading-none">{selectedProduct.name}</h2>
                <p className="text-gray-400 text-[10px] md:text-[12px] tracking-[0.5em] uppercase font-bold mt-4">{selectedProduct.subtitle}</p>
              </div>
              <p className="text-xl md:text-3xl text-gray-600 font-serif italic max-w-3xl mx-auto leading-relaxed whitespace-pre-wrap">"{selectedProduct.description}"</p>
              <p className="text-[#2c2c2c] text-[16px] tracking-[0.3em] font-bold uppercase pt-6">{selectedProduct.price}</p>
            </div>
            {selectedProduct.detailImages && selectedProduct.detailImages.length > 0 && (
              <div className="space-y-24 w-full">
                {selectedProduct.detailImages.map((img, idx) => (
                  <div key={idx} className={`masterpiece-frame w-full aspect-[4/5] overflow-hidden shadow-2xl bg-[#f4f2ee] ${idx % 2 === 0 ? 'md:translate-x-[-5%]' : 'md:translate-x-[5%]'}`}>
                    <img src={img} className="w-full h-full object-cover scale-[1.15]" alt={`${selectedProduct.name} detail ${idx + 1}`} />
                  </div>
                ))}
              </div>
            )}
            
            <div className="pt-12 flex flex-col items-center gap-12 w-full">
              <button 
                onClick={() => { setSelectedProduct(null); window.scrollTo({top: document.getElementById('collection')?.offsetTop || 0, behavior: 'instant'}); }} 
                className="px-20 py-6 border border-[#2c2c2c]/20 text-[#2c2c2c] text-[10px] font-bold uppercase tracking-[0.6em] hover:bg-[#2c2c2c] hover:text-white transition-all duration-700 shadow-sm"
              >
                Close Entry
              </button>
              
              <div className="pt-24 pb-12 flex flex-col items-center opacity-20">
                <h3 className="font-serif text-2xl tracking-[1em] mb-2">NUKUENCO</h3>
                <p className="text-[8px] tracking-[0.5em] uppercase font-bold">L'esprit du temps</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
