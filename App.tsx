
import React, { useState, useEffect, useRef } from 'react';
import { Difficulty, Riddle, GameState, Player, Room } from './types.ts';
import { fetchRiddles, getAIHint } from './services/geminiService.ts';
import { supabase, isSupabaseConfigured } from './lib/supabase.ts';
import { isConfigComplete } from './lib/config.ts';
import { audioService } from './lib/audio.ts';
import Button from './components/Button.tsx';

const AVATARS = ['🚀', '🪐', '🌟', '☄️', '👾', '🤖', '🛸', '🛰️'];
const QUESTION_TIME = 20;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [joinCode, setJoinCode] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<number | null>(null);

  const configStatus = isConfigComplete();

  // نظام العداد التنازلي مع الأصوات
  useEffect(() => {
    if (gameState === 'PLAYING' && selectedAnswer === null) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleAnswer(-1);
            return 0;
          }
          // صوت تكتكة في آخر 5 ثوانٍ
          if (prev <= 6) {
            audioService.play('TICK');
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, selectedAnswer, currentRoom?.current_question]);

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
      colors: ['#4f46e5', '#10b981', '#ffffff']
    });
  };

  const fetchPlayers = async (roomId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false });
    if (data) setPlayers(data);
  };

  useEffect(() => {
    if (!currentRoom || !supabase) return;

    const playersChannel = supabase
      .channel(`room-players-${currentRoom.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${currentRoom.id}` }, () => fetchPlayers(currentRoom.id))
      .subscribe();

    const roomChannel = supabase
      .channel(`room-state-${currentRoom.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoom.id}` }, (payload) => {
        const updated = payload.new as Room;
        
        // تشغيل صوت عند انتهاء اللعبة
        if (updated.status === 'FINISHED' && gameState !== 'FINISHED') {
          audioService.play('WIN');
        }

        setCurrentRoom(updated);
        setGameState(updated.status);
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
    if (!supabase) return;
    audioService.play('CLICK');
    setLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: room } = await supabase.from('rooms').insert([{ code, status: 'LOBBY', current_question: 0, difficulty }]).select().single();
      if (room) {
        const name = prompt('اختر اسمك المستعار:') || 'القائد';
        const { data: p } = await supabase.from('players').insert([{ room_id: room.id, name, avatar: '👑', score: 0 }]).select().single();
        if (p) { setLocalPlayer(p); setCurrentRoom(room); setGameState('LOBBY'); }
      }
    } catch (e) { alert('خطأ في الاتصال'); } finally { setLoading(false); }
  };

  const joinRoom = async () => {
    if (!supabase || !joinCode) return;
    audioService.play('CLICK');
    setLoading(true);
    try {
      const { data: room } = await supabase.from('rooms').select('*').eq('code', joinCode.toUpperCase()).single();
      if (!room) return alert('الغرفة غير موجودة');
      const name = prompt('ما هو اسمك؟') || `لاعب ${Math.floor(Math.random()*100)}`;
      const { data: p } = await supabase.from('players').insert([{ room_id: room.id, name, avatar: AVATARS[Math.floor(Math.random()*AVATARS.length)], score: 0 }]).select().single();
      if (p) { setLocalPlayer(p); setCurrentRoom(room); setGameState(room.status); }
    } catch (e) { alert('رمز غير صحيح'); } finally { setLoading(false); }
  };

  const startNow = async () => {
    if (!currentRoom || !supabase) return;
    audioService.play('CLICK');
    setGameState('LOADING');
    try {
      const riddles = await fetchRiddles(difficulty);
      await supabase.from('rooms').update({ status: 'PLAYING', riddles, current_question: 0 }).eq('id', currentRoom.id);
    } catch (e) { setGameState('LOBBY'); }
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
    if (isLast) {
      await supabase.from('rooms').update({ status: 'FINISHED' }).eq('id', currentRoom.id);
    } else {
      await supabase.from('rooms').update({ current_question: currentRoom.current_question + 1 }).eq('id', currentRoom.id);
    }
  };

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Sound Toggle Button */}
      <button 
        onClick={toggleSound}
        className="fixed top-6 right-6 z-50 glass p-4 rounded-full border-white/10 text-white hover:bg-white/10 transition-all active:scale-90"
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10 animate-float">
          <h1 className="text-6xl font-black text-white mb-2 drop-shadow-[0_0_20px_rgba(79,70,229,0.6)]">لغز الذكاء</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-indigo-500/50"></span>
            <p className="text-indigo-300 font-bold uppercase tracking-widest text-sm">التحدي اللغوي الأكبر</p>
            <span className="h-px w-8 bg-indigo-500/50"></span>
          </div>
        </div>

        {/* Main Card */}
        <div className={`glass rounded-[3.5rem] p-8 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden ${isCorrect === false ? 'shake' : ''}`}>
          
          {gameState === 'START' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={createRoom} size="lg" className="h-20 text-2xl" disabled={loading}>
                  {loading ? '...' : 'تحدي جديد 👑'}
                </Button>
                <div className="flex gap-2">
                  <input 
                    value={joinCode} 
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="رمز الغرفة" 
                    className="flex-1 glass border-white/10 rounded-2xl px-6 text-white text-center font-black text-xl uppercase tracking-widest focus:ring-2 ring-indigo-500 outline-none"
                  />
                  <Button onClick={joinRoom} variant="outline" disabled={loading}>انضمام</Button>
                </div>
              </div>
              
              <div className="flex justify-center flex-wrap gap-3">
                {(Object.values(Difficulty) as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDifficulty(d);
                      audioService.play('CLICK');
                    }}
                    className={`px-6 py-2 rounded-2xl text-sm font-black transition-all border-2 ${difficulty === d ? 'bg-white text-indigo-900 border-white' : 'bg-transparent text-white border-white/10 hover:border-white/30'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {gameState === 'LOADING' && (
            <div className="text-center py-20">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-2xl font-black text-white animate-pulse">نستحضر لك ألغازاً ذكية...</p>
            </div>
          )}

          {(gameState === 'LOBBY' || gameState === 'PLAYING' || gameState === 'FINISHED') && (
            <div className="space-y-8">
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
                <div className="text-right">
                  <span className="text-indigo-300 text-[10px] font-bold block mb-1">رمز الدخول</span>
                  <span className="text-white font-black text-2xl tracking-tighter">{currentRoom?.code}</span>
                </div>
                <div className="flex -space-x-3 overflow-hidden">
                  {players.map(p => (
                    <div key={p.id} className="w-12 h-12 rounded-full glass border-2 border-indigo-500/50 flex items-center justify-center text-2xl shadow-xl ring-2 ring-black/20" title={p.name}>
                      {p.avatar}
                    </div>
                  ))}
                </div>
              </div>

              {gameState === 'LOBBY' && (
                <div className="text-center py-12 space-y-10">
                  <div className="animate-bounce text-7xl">🎮</div>
                  <h3 className="text-3xl font-black text-white">في انتظار العقول...</h3>
                  {localPlayer?.avatar === '👑' ? (
                    <Button onClick={startNow} fullWidth size="lg" className="h-24 text-3xl shadow-[0_15px_40px_rgba(79,70,229,0.4)]">إطلاق اللعبة 🚀</Button>
                  ) : (
                    <p className="text-indigo-400 font-bold italic">المستضيف يجهز الألغاز...</p>
                  )}
                </div>
              )}

              {gameState === 'PLAYING' && currentRoom?.riddles && (
                <div className="space-y-8 relative">
                  <div className="absolute -top-4 -left-4 w-16 h-16 glass rounded-full flex items-center justify-center border-2 border-indigo-500/30">
                    <span className={`text-2xl font-black ${timeLeft < 5 ? 'text-rose-500 animate-ping' : 'text-indigo-300'}`}>{timeLeft}</span>
                  </div>

                  <div className="text-center pt-6">
                    <span className="text-xs font-black bg-indigo-500/20 text-indigo-300 px-4 py-1 rounded-full uppercase tracking-widest">المستوى {difficulty}</span>
                    <h2 className="text-3xl font-black text-white mt-6 leading-tight min-h-[100px]">
                      {currentRoom.riddles[currentRoom.current_question].question}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentRoom.riddles[currentRoom.current_question].options.map((opt, i) => {
                      const isSelected = selectedAnswer === i;
                      const isCorrectIdx = i === currentRoom.riddles![currentRoom.current_question].correctIndex;
                      
                      let btnStyle = "p-6 rounded-[2rem] border-2 text-right transition-all duration-300 text-xl font-bold flex items-center justify-between ";
                      if (selectedAnswer === null) btnStyle += "glass border-white/5 hover:bg-white/10 hover:translate-y-[-2px]";
                      else if (isCorrectIdx) btnStyle += "bg-emerald-500/40 border-emerald-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]";
                      else if (isSelected) btnStyle += "bg-rose-500/40 border-rose-400 text-white";
                      else btnStyle += "opacity-30 border-white/5 grayscale";

                      return (
                        <button key={i} disabled={selectedAnswer !== null} onClick={() => handleAnswer(i)} className={btnStyle}>
                          <span>{opt}</span>
                          {selectedAnswer !== null && isCorrectIdx && <span className="text-2xl">✨</span>}
                        </button>
                      );
                    })}
                  </div>

                  {selectedAnswer === null && (
                    <div className="flex justify-center">
                      <button onClick={showHint} disabled={hint !== null} className="text-indigo-400 text-sm font-black hover:text-white transition-colors flex items-center gap-2">
                        <span>💡 اطلب تلميحة ذكية</span>
                      </button>
                    </div>
                  )}

                  {hint && selectedAnswer === null && (
                    <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/30 text-center animate-in slide-in-from-bottom-2">
                      <p className="text-indigo-200 text-sm italic">"{hint}"</p>
                    </div>
                  )}

                  {selectedAnswer !== null && (
                    <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 text-center animate-in zoom-in-95 space-y-4">
                      <p className="text-white text-lg font-bold">"{currentRoom.riddles[currentRoom.current_question].explanation}"</p>
                      {localPlayer?.avatar === '👑' && (
                        <Button onClick={nextQuestion} fullWidth variant="neon" className="h-16">السؤال التالي ➡️</Button>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {gameState === 'FINISHED' && (
                <div className="text-center py-6 space-y-8">
                  <div className="text-8xl mb-4 animate-float">🏆</div>
                  <h2 className="text-5xl font-black text-white tracking-tighter">منصة التتويج</h2>
                  <div className="space-y-3">
                    {players.map((p, i) => (
                      <div key={p.id} className={`flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all ${i === 0 ? 'bg-white/10 border-indigo-500/50 scale-105' : 'glass border-white/5 opacity-80'}`}>
                        <div className="flex items-center gap-4 text-right">
                          <span className={`text-2xl font-black ${i === 0 ? 'text-indigo-400' : 'text-white/40'}`}>#{i + 1}</span>
                          <span className="text-3xl">{p.avatar}</span>
                          <span className="font-black text-xl text-white">{p.name} {p.id === localPlayer?.id ? '(أنت)' : ''}</span>
                        </div>
                        <span className="bg-indigo-500/20 px-6 py-2 rounded-2xl font-black text-2xl text-indigo-300">{p.score}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => window.location.reload()} fullWidth variant="outline" className="h-16">العودة للمجرة الرئيسية 🏠</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-4 text-white/20 text-[10px] font-bold uppercase tracking-[1em] pointer-events-none">
        Intelligence Word Puzzle Engine v2.0
      </div>
    </div>
  );
};

export default App;
