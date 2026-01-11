
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Difficulty, Riddle, GameState, Player, Room, ThemeType, ThemeConfig, GameMode, ChatMessage } from './types.ts';
import { fetchRiddles, getAIHint, createGuessWhoChat } from './services/geminiService.ts';
import { supabase, isSupabaseConfigured } from './lib/supabase.ts';
import { isConfigComplete } from './lib/config.ts';
import { audioService } from './lib/audio.ts';
import Button from './components/Button.tsx';

const AVATARS = ['🚀', '🪐', '🌟', '☄️', '👾', '🤖', '🛸', '🛰️'];
const QUESTION_TIME = 20;
const MAX_GUESS_QUESTIONS = 20;

const THEMES: ThemeConfig[] = [
  { id: 'cosmic', name: 'الفضاء الكوني', bg: 'radial-gradient(circle at top right, #1e1b4b, #0f172a)', accent: '#4f46e5', preview: 'bg-indigo-900' },
  { id: 'emerald', name: 'غابة الزمرد', bg: 'radial-gradient(circle at top right, #064e3b, #022c22)', accent: '#10b981', preview: 'bg-emerald-900' },
  { id: 'sunset', name: 'شفق الغروب', bg: 'radial-gradient(circle at top right, #4c1d95, #1e1b4b, #450a0a)', accent: '#f43f5e', preview: 'bg-rose-900' },
  { id: 'midnight', name: 'منتصف الليل', bg: 'radial-gradient(circle at top right, #1e293b, #020617)', accent: '#94a3b8', preview: 'bg-slate-900' },
  { id: 'ocean', name: 'أعماق المحيط', bg: 'radial-gradient(circle at top right, #164e63, #083344)', accent: '#06b6d4', preview: 'bg-cyan-900' }
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [gameMode, setGameMode] = useState<GameMode>('RIDDLES');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('cosmic');
  const [joinCode, setJoinCode] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [isMuted, setIsMuted] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const chatRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const timerRef = useRef<number | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  const activeTheme = useMemo(() => THEMES.find(t => t.id === currentTheme) || THEMES[0], [currentTheme]);
  const configStatus = isConfigComplete();
  const maxScore = useMemo(() => Math.max(...players.map(p => p.score), 100), [players]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 40,
        y: (e.clientY / window.innerHeight - 0.5) * 40
      };
      const layers = document.querySelectorAll<HTMLElement>('.bg-layer');
      layers.forEach((layer, i) => {
        const factor = (i + 1) * 0.5;
        layer.style.transform = `translate3d(${mousePos.current.x * factor}px, ${mousePos.current.y * factor}px, 0)`;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING' && gameMode === 'RIDDLES' && selectedAnswer === null) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleAnswer(-1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, selectedAnswer, currentRoom?.current_question, gameMode]);

  const toggleSound = () => {
    const muted = audioService.toggleMute();
    setIsMuted(muted);
    audioService.play('CLICK');
  };

  const fireConfetti = () => {
    // @ts-ignore
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: [activeTheme.accent, '#ffffff']
    });
  };

  const fetchPlayers = async (roomId: string) => {
    if (!supabase || !isSupabaseConfigured) return;
    try {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('score', { ascending: false });
      if (data) setPlayers(data);
    } catch (e) {
      console.error("Fetch Players Error:", e);
    }
  };

  useEffect(() => {
    if (!currentRoom || !supabase || !isSupabaseConfigured) return;

    const playersChannel = supabase
      .channel(`room-players-${currentRoom.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${currentRoom.id}` }, () => fetchPlayers(currentRoom.id))
      .subscribe();

    const roomChannel = supabase
      .channel(`room-state-${currentRoom.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoom.id}` }, (payload) => {
        const updated = payload.new as Room;
        if (updated.status === 'FINISHED' && gameState !== 'FINISHED') audioService.play('WIN');
        setCurrentRoom(updated);
        setGameState(updated.status);
        setGameMode(updated.game_mode || 'RIDDLES');
        setSelectedAnswer(null);
        setIsCorrect(null);
        setHint(null);
        setTimeLeft(QUESTION_TIME);
      }).subscribe();

    fetchPlayers(currentRoom.id);
    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [currentRoom?.id, gameState]);

  const createRoom = async () => {
    if (!supabase || !isSupabaseConfigured) {
      alert("قاعدة البيانات غير مهيأة بشكل صحيح.");
      return;
    }
    
    audioService.play('CLICK');
    setLoading(true);
    
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // إدخال الغرفة الجديدة
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert([{ 
          code, 
          status: 'LOBBY', 
          current_question: 0, 
          difficulty, 
          game_mode: gameMode 
        }])
        .select()
        .single();

      if (roomError) {
        // إذا كان الخطأ متعلقاً بعدم وجود عمود game_mode
        if (roomError.message?.includes("column \"game_mode\" of relation \"rooms\" does not exist")) {
          throw new Error("يرجى إضافة عمود 'game_mode' لجدول 'rooms' في Supabase SQL Editor.");
        }
        throw roomError;
      }

      if (room) {
        const name = prompt('اختر اسمك المستعار:') || 'القائد';
        const { data: p, error: pError } = await supabase
          .from('players')
          .insert([{ 
            room_id: room.id, 
            name, 
            avatar: '👑', 
            score: 0 
          }])
          .select()
          .single();
        
        if (pError) throw pError;
        
        if (p) {
          setLocalPlayer(p);
          setCurrentRoom(room);
          setGameState('LOBBY');
        }
      }
    } catch (e: any) {
      console.error("CRITICAL: Room Creation Error:", e);
      alert(`فشل إنشاء الغرفة: ${e.message || 'خطأ غير متوقع'}`);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!supabase || !joinCode || !isSupabaseConfigured) return;
    audioService.play('CLICK');
    setLoading(true);
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .single();

      if (roomError || !room) throw new Error('الغرفة غير موجودة');

      const name = prompt('ما هو اسمك؟') || `لاعب ${Math.floor(Math.random()*100)}`;
      const { data: p, error: pError } = await supabase
        .from('players')
        .insert([{ 
          room_id: room.id, 
          name, 
          avatar: AVATARS[Math.floor(Math.random()*AVATARS.length)], 
          score: 0 
        }])
        .select()
        .single();

      if (pError) throw pError;

      if (p) { 
        setLocalPlayer(p); 
        setCurrentRoom(room); 
        setGameState(room.status); 
        setGameMode(room.game_mode || 'RIDDLES');
      }
    } catch (e: any) {
      alert(e.message || 'فشل الانضمام');
    } finally {
      setLoading(false);
    }
  };

  const startNow = async () => {
    if (!currentRoom || !supabase) return;
    audioService.play('CLICK');
    setGameState('LOADING');
    try {
      if (gameMode === 'RIDDLES') {
        const riddles = await fetchRiddles(difficulty);
        const { error } = await supabase.from('rooms').update({ status: 'PLAYING', riddles, current_question: 0 }).eq('id', currentRoom.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rooms').update({ status: 'PLAYING' }).eq('id', currentRoom.id);
        if (error) throw error;
        const chat = createGuessWhoChat();
        chatRef.current = chat;
        setChatHistory([{ role: 'model', text: 'أهلاً بك! لقد اخترت شخصية سرية في ذهني. ابدأ بطرح أسئلتك، وسأعطيك تلميحات ذكية. تذكر، لديك 20 سؤالاً فقط!' }]);
      }
    } catch (e) {
      console.error(e);
      setGameState('LOBBY');
      alert('حدث خطأ أثناء بدء اللعبة');
    }
  };

  const handleAnswer = async (index: number) => {
    if (!supabase || selectedAnswer !== null || !currentRoom?.riddles || !localPlayer) return;
    const currentRiddle = currentRoom.riddles[currentRoom.current_question];
    const correct = index === currentRiddle.correctIndex;
    setSelectedAnswer(index);
    setIsCorrect(correct);
    if (correct) {
      audioService.play('SUCCESS');
      fireConfetti();
      const bonus = Math.floor(timeLeft / 2);
      const newScore = localPlayer.score + 10 + bonus;
      setLocalPlayer({ ...localPlayer, score: newScore });
      await supabase.from('players').update({ score: newScore }).eq('id', localPlayer.id);
    } else {
      audioService.play('FAILURE');
    }
  };

  const sendChatMessage = async () => {
    if (!currentInput.trim() || !chatRef.current || questionCount >= MAX_GUESS_QUESTIONS || loading) return;
    
    setLoading(true);
    const userMsg = currentInput.trim();
    setCurrentInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuestionCount(prev => prev + 1);
    audioService.play('CLICK');

    try {
      const result = await chatRef.current.sendMessage({ message: userMsg });
      const modelResponse = result.text || 'لم أستطع فهم السؤال، حاول مجدداً.';
      setChatHistory(prev => [...prev, { role: 'model', text: modelResponse }]);
      
      if (modelResponse.includes('✅')) {
        fireConfetti();
        audioService.play('SUCCESS');
        if (localPlayer) {
          const newScore = localPlayer.score + (20 - questionCount) * 5;
          setLocalPlayer({ ...localPlayer, score: newScore });
          await supabase.from('players').update({ score: newScore }).eq('id', localPlayer.id);
        }
      } else if (modelResponse.includes('❌')) {
        audioService.play('FAILURE');
      } else {
        audioService.play('HINT');
      }

    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'model', text: 'عذراً، حدث خطأ في التواصل مع الذكاء الاصطناعي.' }]);
    } finally {
      setLoading(false);
    }
  };

  const showHint = async () => {
    if (!currentRoom?.riddles) return;
    audioService.play('HINT');
    const current = currentRoom.riddles[currentRoom.current_question];
    const aiHint = await getAIHint(current.question, current.options[current.correctIndex]);
    setHint(aiHint);
  };

  const nextQuestion = async () => {
    if (!supabase || !currentRoom || !currentRoom.riddles) return;
    audioService.play('CLICK');
    const isLast = currentRoom.current_question >= currentRoom.riddles.length - 1;
    try {
      if (isLast) {
        await supabase.from('rooms').update({ status: 'FINISHED' }).eq('id', currentRoom.id);
      } else {
        await supabase.from('rooms').update({ current_question: currentRoom.current_question + 1 }).eq('id', currentRoom.id);
      }
    } catch (e) {
      alert('خطأ في الانتقال');
    }
  };

  const Leaderboard = ({ playersList }: { playersList: Player[] }) => (
    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
      {playersList.map((p, i) => {
        const progress = Math.min((p.score / maxScore) * 100, 100);
        return (
          <div key={p.id} className="relative group">
            <div className={`flex items-center justify-between p-3 rounded-2xl glass border border-white/5 transition-all duration-500 overflow-hidden ${i === 0 && p.score > 0 ? 'ring-2' : ''}`} style={i === 0 && p.score > 0 ? { '--tw-ring-color': activeTheme.accent } as React.CSSProperties : {}}>
              <div className="absolute inset-0 opacity-10 transition-all duration-1000 ease-out z-0" style={{ backgroundColor: activeTheme.accent, width: `${progress}%` }}></div>
              <div className="flex items-center gap-3 relative z-10">
                <span className="text-xs font-black text-white/40 w-4">#{i + 1}</span>
                <span className="text-xl bg-black/20 rounded-full w-8 h-8 flex items-center justify-center">{p.avatar}</span>
                <span className={`font-bold truncate max-w-[120px] ${p.id === localPlayer?.id ? 'text-white' : 'text-white/80'}`}>
                  {p.name} {p.id === localPlayer?.id ? '⚡' : ''}
                </span>
              </div>
              <div className="relative z-10">
                <span className="px-3 py-1 rounded-xl font-black text-sm" style={{ backgroundColor: `${activeTheme.accent}20`, color: activeTheme.accent }}>
                  {p.score}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!configStatus || !isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#020617]">
        <div className="glass p-12 rounded-[3rem] text-center border-white/5 shadow-2xl">
          <div className="text-6xl mb-6 animate-pulse">🛰️</div>
          <h2 className="text-3xl font-black text-white mb-4">النظام غير جاهز</h2>
          <p className="text-indigo-200/60 mb-8">يرجى ضبط مفاتيح البيئة في Netlify</p>
          <Button onClick={() => window.location.reload()} variant="outline">إعادة التشغيل</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-700">
      <div className="bg-layer opacity-40" style={{ background: activeTheme.bg }}></div>
      <div className="bg-layer opacity-20" style={{ backgroundImage: `radial-gradient(circle at 20% 30%, ${activeTheme.accent}, transparent 40%)` }}></div>
      <div className="bg-layer opacity-10" style={{ backgroundImage: `radial-gradient(circle at 80% 70%, white, transparent 20%)` }}></div>

      <div className="fixed top-6 right-6 z-50 flex gap-3">
        <button onClick={() => setShowThemePicker(true)} className="glass p-4 rounded-full border-white/10 text-white hover:bg-white/10 transition-all active:scale-90" title="تغيير المظهر">🎨</button>
        <button onClick={toggleSound} className="glass p-4 rounded-full border-white/10 text-white hover:bg-white/10 transition-all active:scale-90">{isMuted ? '🔇' : '🔊'}</button>
      </div>

      {showThemePicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/40 animate-in fade-in duration-300">
          <div className="glass w-full max-w-lg p-8 rounded-[3rem] border-white/10 shadow-2xl text-center space-y-6">
            <h2 className="text-3xl font-black text-white">اختر سمة الغرفة</h2>
            <div className="grid grid-cols-2 gap-4">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => { setCurrentTheme(t.id); setShowThemePicker(false); audioService.play('CLICK'); }} className={`p-4 rounded-3xl border-2 transition-all group ${currentTheme === t.id ? 'border-white scale-105' : 'border-white/5 hover:border-white/20'}`}>
                  <div className={`h-16 w-full rounded-2xl mb-3 shadow-inner ${t.preview} transition-transform group-hover:scale-95`}></div>
                  <span className="font-bold text-white block">{t.name}</span>
                </button>
              ))}
            </div>
            <Button onClick={() => setShowThemePicker(false)} variant="outline" fullWidth>إغلاق</Button>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl z-10 flex flex-col lg:flex-row gap-6 items-start">
        
        {gameState === 'PLAYING' && (
          <div className="w-full lg:w-1/4 glass rounded-[2.5rem] p-6 border-white/10 order-2 lg:order-1 self-stretch">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeTheme.accent }}></span>
              الترتيب الحالي
            </h3>
            <Leaderboard playersList={players} />
          </div>
        )}

        <div className="flex-1 w-full order-1 lg:order-2">
          <div className="text-center mb-8 animate-float">
            <h1 className="text-6xl font-black text-white mb-2" style={{ textShadow: `0 0 20px ${activeTheme.accent}80` }}>لغز الذكاء</h1>
            <div className="flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-white/30"></span>
              <p className="font-bold uppercase tracking-widest text-sm" style={{ color: `${activeTheme.accent}` }}>التحدي اللغوي الأكبر</p>
              <span className="h-px w-8 bg-white/30"></span>
            </div>
          </div>

          <div className={`glass rounded-[3.5rem] p-8 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden ${isCorrect === false ? 'shake' : ''}`}>
            
            {gameState === 'START' && (
              <div className="space-y-8">
                <div className="flex justify-center gap-4 mb-4">
                  <button onClick={() => {setGameMode('RIDDLES'); audioService.play('CLICK');}} className={`flex-1 p-4 rounded-2xl border-2 transition-all ${gameMode === 'RIDDLES' ? 'border-white bg-white/10' : 'border-white/5 glass'}`}>
                    <span className="block text-2xl">🧩</span>
                    <span className="font-black">تحدي الألغاز</span>
                  </button>
                  <button onClick={() => {setGameMode('GUESS_WHO'); audioService.play('CLICK');}} className={`flex-1 p-4 rounded-2xl border-2 transition-all ${gameMode === 'GUESS_WHO' ? 'border-white bg-white/10' : 'border-white/5 glass'}`}>
                    <span className="block text-2xl">🎭</span>
                    <span className="font-black">خمن الشخصية</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={createRoom} 
                    size="lg" 
                    className="h-20 text-2xl relative" 
                    disabled={loading} 
                    style={{ backgroundColor: activeTheme.accent }}
                  >
                    {loading ? (
                      <span className="flex items-center gap-3">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        جاري الإنشاء...
                      </span>
                    ) : 'تحدي جديد 👑'}
                  </Button>
                  <div className="flex gap-2">
                    <input 
                      value={joinCode} 
                      onChange={(e) => setJoinCode(e.target.value)} 
                      placeholder="رمز الغرفة" 
                      className="flex-1 glass border-white/10 rounded-2xl px-6 text-white text-center font-black text-xl uppercase tracking-widest focus:ring-2 outline-none" 
                      style={{ '--tw-ring-color': activeTheme.accent } as React.CSSProperties} 
                    />
                    <Button onClick={joinRoom} variant="outline" disabled={loading}>
                      {loading && joinCode ? 'جاري...' : 'انضمام'}
                    </Button>
                  </div>
                </div>
                
                {gameMode === 'RIDDLES' && (
                  <div className="flex justify-center flex-wrap gap-3">
                    {(Object.values(Difficulty) as Difficulty[]).map((d) => (
                      <button key={d} onClick={() => { setDifficulty(d); audioService.play('CLICK'); }} className={`px-6 py-2 rounded-2xl text-sm font-black transition-all border-2 ${difficulty === d ? 'bg-white text-indigo-900 border-white' : 'bg-transparent text-white border-white/10 hover:border-white/30'}`}>{d}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {gameState === 'LOADING' && (
              <div className="text-center py-20">
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: `${activeTheme.accent}20` }}></div>
                  <div className="absolute inset-0 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: activeTheme.accent, borderTopColor: 'transparent' }}></div>
                </div>
                <p className="text-2xl font-black text-white animate-pulse">نستحضر لك عالم الذكاء...</p>
              </div>
            )}

            {(gameState === 'LOBBY' || gameState === 'PLAYING' || gameState === 'FINISHED') && (
              <div className="space-y-8">
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
                  <div className="text-right">
                    <span className="text-white/60 text-[10px] font-bold block mb-1">رمز الدخول</span>
                    <span className="text-white font-black text-2xl tracking-tighter">{currentRoom?.code}</span>
                  </div>
                  <div className="bg-white/10 px-4 py-1 rounded-full text-xs font-black" style={{ color: activeTheme.accent }}>{gameMode === 'RIDDLES' ? 'أطوار: الألغاز' : 'أطوار: خمن'}</div>
                </div>

                {gameState === 'LOBBY' && (
                  <div className="space-y-8">
                    <div className="text-center py-6">
                      <div className="animate-bounce text-7xl mb-6">{gameMode === 'RIDDLES' ? '🎮' : '🕵️'}</div>
                      <h3 className="text-3xl font-black text-white mb-2">ردهة المتنافسين</h3>
                      <p className="text-white/40 text-sm">في انتظار العقول لاكتمال النصاب...</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass rounded-[2rem] p-6 border-white/5">
                        <h4 className="font-black text-white/60 text-xs uppercase tracking-widest mb-4">المشاركون الآن</h4>
                        <Leaderboard playersList={players} />
                      </div>
                      <div className="flex flex-col justify-center gap-6">
                        {localPlayer?.avatar === '👑' ? (
                          <Button onClick={startNow} fullWidth size="lg" className="h-20 text-2xl shadow-xl" style={{ backgroundColor: activeTheme.accent }}>إطلاق اللعبة 🚀</Button>
                        ) : (
                          <div className="text-center p-4 glass rounded-2xl border-white/5 border animate-pulse">
                            <p className="font-bold italic text-sm" style={{ color: activeTheme.accent }}>المستضيف يجهز الألغاز...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {gameState === 'PLAYING' && gameMode === 'RIDDLES' && currentRoom?.riddles && (
                  <div className="space-y-8 relative">
                    <div className="absolute -top-4 -left-4 w-16 h-16 glass rounded-full flex items-center justify-center border-2" style={{ borderColor: `${activeTheme.accent}30` }}>
                      <span className={`text-2xl font-black ${timeLeft < 5 ? 'text-rose-500 animate-ping' : ''}`} style={{ color: timeLeft >= 5 ? activeTheme.accent : undefined }}>{timeLeft}</span>
                    </div>
                    <div className="text-center pt-6">
                      <span className="text-xs font-black px-4 py-1 rounded-full uppercase tracking-widest" style={{ backgroundColor: `${activeTheme.accent}20`, color: activeTheme.accent }}>المستوى {difficulty}</span>
                      <h2 className="text-3xl font-black text-white mt-6 leading-tight min-h-[100px]">{currentRoom.riddles[currentRoom.current_question].question}</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentRoom.riddles[currentRoom.current_question].options.map((opt, i) => (
                        <button key={i} disabled={selectedAnswer !== null} onClick={() => handleAnswer(i)} className={`p-6 rounded-[2rem] border-2 text-right transition-all duration-300 text-xl font-bold flex items-center justify-between ${selectedAnswer === null ? 'glass border-white/5 hover:bg-white/10' : i === currentRoom.riddles![currentRoom.current_question].correctIndex ? 'bg-emerald-500/40 border-emerald-400' : selectedAnswer === i ? 'bg-rose-500/40 border-rose-400' : 'opacity-30 border-white/5'}`}>
                          <span>{opt}</span>
                          {selectedAnswer !== null && i === currentRoom.riddles![currentRoom.current_question].correctIndex && <span className="text-2xl">✨</span>}
                        </button>
                      ))}
                    </div>
                    {selectedAnswer === null && (
                      <div className="flex justify-center">
                        <button onClick={showHint} disabled={hint !== null} className="text-sm font-black hover:text-white transition-colors flex items-center gap-2" style={{ color: activeTheme.accent }}><span>💡 اطلب تلميحة ذكية</span></button>
                      </div>
                    )}
                    {hint && selectedAnswer === null && (
                      <div className="p-4 rounded-2xl border text-center animate-in slide-in-from-bottom-2" style={{ backgroundColor: `${activeTheme.accent}10`, borderColor: `${activeTheme.accent}30` }}>
                        <p className="text-white/80 text-sm italic">"{hint}"</p>
                      </div>
                    )}
                    {selectedAnswer !== null && (
                      <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 text-center animate-in zoom-in-95 space-y-4">
                        <p className="text-white text-lg font-bold">"{currentRoom.riddles[currentRoom.current_question].explanation}"</p>
                        {localPlayer?.avatar === '👑' && <Button onClick={nextQuestion} fullWidth variant="neon" className="h-16">السؤال التالي ➡️</Button>}
                      </div>
                    )}
                  </div>
                )}

                {gameState === 'PLAYING' && gameMode === 'GUESS_WHO' && (
                  <div className="flex flex-col h-[500px]">
                    <div className="flex justify-between items-center mb-4 px-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs">الأسئلة المستخدمة:</span>
                        <span className="font-black" style={{ color: activeTheme.accent }}>{questionCount} / {MAX_GUESS_QUESTIONS}</span>
                      </div>
                      <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-500" style={{ width: `${(questionCount / MAX_GUESS_QUESTIONS) * 100}%`, backgroundColor: activeTheme.accent }}></div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[80%] p-4 rounded-[2rem] ${msg.role === 'user' ? 'bg-white/10 text-white rounded-tr-none' : 'text-indigo-900 rounded-tl-none font-bold'}`} style={msg.role === 'model' ? { backgroundColor: activeTheme.accent, color: '#fff' } : {}}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="flex gap-2">
                      <input 
                        value={currentInput} 
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder="اطرح سؤالاً أو خمن الشخصية..." 
                        className="flex-1 glass border-white/10 rounded-[2rem] px-6 py-4 text-white focus:ring-2 outline-none"
                        style={{ '--tw-ring-color': activeTheme.accent } as React.CSSProperties}
                        disabled={loading || questionCount >= MAX_GUESS_QUESTIONS}
                      />
                      <button 
                        onClick={sendChatMessage}
                        disabled={loading || !currentInput.trim() || questionCount >= MAX_GUESS_QUESTIONS}
                        className="w-14 h-14 flex items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-50"
                        style={{ backgroundColor: activeTheme.accent }}
                      >
                        {loading ? '...' : '📤'}
                      </button>
                    </div>
                  </div>
                )}
                
                {gameState === 'FINISHED' && (
                  <div className="text-center py-6 space-y-8">
                    <div className="text-8xl mb-4 animate-float">🏆</div>
                    <h2 className="text-5xl font-black text-white tracking-tighter">انتهت الجولة</h2>
                    <Leaderboard playersList={players} />
                    <Button onClick={() => window.location.reload()} fullWidth variant="outline" className="h-16">العودة للرئيسية 🏠</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-4 text-white/20 text-xs font-bold pointer-events-none text-center">
        جميع الحقوق محفوظة 2026 ©
      </div>
    </div>
  );
};

export default App;
