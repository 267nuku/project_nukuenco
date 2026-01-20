
import React, { useState, useEffect } from 'react';
import { NAV_LINKS } from '../constants';
import { getApiKeyStatus } from '../services/geminiService';

interface NavbarProps {
  isDirector: boolean;
  setIsDirector: (val: boolean) => void;
  isSaving?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ isDirector, setIsDirector, isSaving }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [apiStatus, setApiStatus] = useState(getApiKeyStatus());

  useEffect(() => {
    const handleScroll = () => { setIsScrolled(window.scrollY > 50); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setApiStatus(getApiKeyStatus());
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const id = href.substring(1);
      const el = document.getElementById(id);
      if (el) {
        const offset = 80; // 상단바 높이 고려
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = el.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
      if (isMenuOpen) setIsMenuOpen(false);
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 px-4 md:px-8 py-4 md:py-6 ${
      isScrolled ? 'bg-[#fcfbf7]/95 backdrop-blur-md border-b border-[#e5e0d8] shadow-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-[1800px] mx-auto flex items-center justify-between">
        {/* Desktop Links */}
        <div className="hidden lg:flex space-x-12 items-center">
          {NAV_LINKS.slice(0, 3).map((link) => (
            <a 
              key={link.label} 
              href={link.href} 
              onClick={(e) => handleLinkClick(e, link.href)}
              className={`text-[10px] tracking-[0.4em] font-bold uppercase transition-all duration-500 hover:text-[#E35205] ${isScrolled ? 'text-[#2c2c2c]' : 'text-white'}`}
            >
              {link.label}
            </a>
          ))}
          {/* API Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 ${
            apiStatus.available 
              ? (isScrolled ? 'border-green-100 bg-green-50 text-green-600' : 'border-white/10 bg-white/5 text-white/60')
              : (isScrolled ? 'border-red-100 bg-red-50 text-red-600' : 'border-red-500/20 bg-red-500/5 text-red-400')
          }`}>
            <div className={`w-1 h-1 rounded-full ${apiStatus.available ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="text-[7px] tracking-widest font-bold uppercase">{apiStatus.available ? 'Mori Ready' : 'API Error'}</span>
          </div>

          {/* Permanent Save Indicator */}
          {isDirector && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 ${isScrolled ? 'border-green-100 bg-green-50 text-green-600' : 'border-white/10 bg-white/5 text-white/60'}`}>
              <div className={`w-1 h-1 rounded-full ${isSaving ? 'bg-orange-500 animate-ping' : 'bg-green-500'}`}></div>
              <span className="text-[7px] tracking-widest font-bold uppercase">{isSaving ? 'Recording...' : 'Atelier Fixed'}</span>
            </div>
          )}
        </div>

        {/* Center Logo */}
        <div className="flex flex-col items-center group cursor-pointer absolute left-1/2 -translate-x-1/2" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <h1 className={`font-serif text-lg md:text-3xl tracking-[0.2em] md:tracking-[0.3em] font-bold transition-all duration-700 group-hover:tracking-[0.45em] ${isScrolled ? 'text-[#2c2c2c]' : 'text-white'}`}>NUKUENCO</h1>
          <p className={`text-[6px] md:text-[8px] tracking-[0.5em] mt-1 uppercase font-light transition-opacity duration-700 ${isScrolled ? 'text-[#b58d59]' : 'text-white/40'}`}>Atelier</p>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4 md:gap-8">
          <div className={`hidden md:flex p-1 rounded-full border transition-all duration-700 ${isScrolled ? 'bg-[#f4f2ee] border-[#e5e0d8]' : 'bg-white/5 border-white/10'}`}>
            <button onClick={() => setIsDirector(true)} className={`px-4 md:px-6 py-2 rounded-full text-[8px] md:text-[9px] tracking-[0.1em] md:tracking-[0.2em] font-bold transition-all uppercase ${isDirector ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>Edit</button>
            <button onClick={() => setIsDirector(false)} className={`px-4 md:px-6 py-2 rounded-full text-[8px] md:text-[9px] tracking-[0.1em] md:tracking-[0.2em] font-bold transition-all uppercase ${!isDirector ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>View</button>
          </div>
          <button className={`lg:hidden p-1 ${isScrolled ? 'text-[#2c2c2c]' : 'text-white'}`} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M12 12h8M4 18h16"} /></svg>
          </button>
          <a 
            href={NAV_LINKS[3].href} 
            onClick={(e) => handleLinkClick(e, NAV_LINKS[3].href)} 
            className={`hidden lg:block text-[10px] tracking-[0.4em] font-bold uppercase transition-all duration-500 hover:text-[#E35205] ${isScrolled ? 'text-[#2c2c2c]' : 'text-white'}`}
          >
            {NAV_LINKS[3].label}
          </a>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-0 bg-[#fcfbf7] z-[200] p-10 flex flex-col space-y-8 animate-fade-in-up">
          <div className="flex justify-between items-center mb-12">
            <h1 className="font-serif text-2xl tracking-[0.3em] font-bold text-[#2c2c2c]">NUKUENCO</h1>
            <button onClick={() => setIsMenuOpen(false)} className="text-[#2c2c2c]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex flex-col space-y-6">
            {NAV_LINKS.map((link) => (
              <a 
                key={link.label} 
                href={link.href} 
                className="text-3xl tracking-[0.1em] font-serif border-b border-[#e5e0d8] pb-6" 
                onClick={(e) => handleLinkClick(e, link.href)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-10 flex gap-4">
               <button onClick={() => { setIsDirector(true); setIsMenuOpen(false); }} className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest ${isDirector ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>Edit Mode</button>
               <button onClick={() => { setIsDirector(false); setIsMenuOpen(false); }} className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest ${!isDirector ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>View Mode</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
