
import React, { useState, useEffect } from 'react';
import { Difficulty, Riddle, GameState, Player, Room } from './types.ts';
import { fetchRiddles } from './services/geminiService.ts';
import { supabase, isSupabaseConfigured } from './lib/supabase.ts';
import { isConfigComplete, getMissingKeys } from './lib/config.ts';
import Button from './components/Button.tsx';

const AVATARS = ['🦁', '🐯', '🦊', '🐨', '🐼', '🐸', '🤖', '👻'];

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

  // 1. فحص أمان المفاتيح (Security Check)
  if (!isConfigComplete() || !isSupabaseConfigured) {
    const missing = getMissingKeys();
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-950 font-['Tajawal']">
        <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 max-w-lg shadow-2xl">
          <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔐</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-4">تنبيه أمني: إعدادات ناقصة</h2>
          <p className="text-indigo-200/80 mb-6 leading-relaxed">
            لضمان عمل التطبيق بأمان، يرجى تزويد متغيرات البيئة المطلوبة. 
            المفاتيح التالية مفقودة أو غير صالحة:
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {missing.map(key => (
              <span key={key} className="bg-rose-500/10 text-rose-300 px-4 py-1.5 rounded-full text-sm border border-rose-500/20">
                {key}
              </span>
            ))}
          </div>
          <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-xs text-indigo-300 text-right space-y-2 mb-8">
            <p>• تأكد من ضبط <b>process.env.API_KEY</b></p>
            <p>• تأكد من ضبط <b>VITE_SUPABASE_URL</b> و <b>VITE_SUPABASE_ANON_KEY</b></p>
          </div>
          <Button onClick={() => window.location.reload()} fullWidth>تحديث الصفحة</Button>
        </div>
      </div>
    );
  }

  const fetchPlayers = async (roomId: string) => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false });
    if (data) setPlayers(data);
  };

  useEffect(() => {
    if (!currentRoom) return;

    const playersChannel = supabase
      .channel(`room-players-${currentRoom.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${currentRoom.id}` }, 
        () => fetchPlayers(currentRoom.id)
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`room-state-${currentRoom.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoom.id}` },
        (payload) => {
          const updated = payload.new as Room;
          setCurrentRoom(updated);
          setGameState(updated.status);
          setSelectedAnswer(null);
          setIsCorrect(null);
        }
      ).subscribe();

    fetchPlayers(currentRoom.id);

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [currentRoom?.id]);

  const createRoom = async () => {
    setLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: room, error } = await supabase
        .from('rooms')
        .insert([{ code, status: 'LOBBY', current_question: 0, difficulty }])
        .select().single();

      if (room) {
        const name = prompt('اسمك (المستضيف):') || 'المستضيف';
        const { data: p } = await supabase
          .from('players')
          .insert([{ room_id: room.id, name, avatar: '👑', score: 0 }])
          .select().single();
        if (p) {
          setLocalPlayer(p);
          setCurrentRoom(room);
          setGameState('LOBBY');
        }
      }
    } catch (e) {
      alert('فشل إنشاء الغرفة. يرجى مراجعة إعدادات قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!joinCode) return alert('أدخل رمز الغرفة');
    setLoading(true);
    try {
      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .single();

      if (!room) return alert('الغرفة غير موجودة');

      const name = prompt('اسمك:') || `لاعب ${Math.floor(Math.random()*100)}`;
      const { data: p } = await supabase
        .from('players')
        .insert([{ room_id: room.id, name, avatar: AVATARS[Math.floor(Math.random()*AVATARS.length)], score: 0 }])
        .select().single();

      if (p) {
        setLocalPlayer(p);
        setCurrentRoom(room);
        setGameState(room.status);
      }
    } catch (e) {
      alert('خطأ في الانضمام');
    } finally {
      setLoading(false);
    }
  };

  const startNow = async () => {
    if (!currentRoom) return;
    setGameState('LOADING');
    try {
      const riddles = await fetchRiddles(difficulty);
      await supabase.from('rooms').update({ 
        status: 'PLAYING', 
        riddles,
        current_question: 0 
      }).eq('id', currentRoom.id);
    } catch (e) {
      setGameState('LOBBY');
    }
  };

  const handleAnswer = async (index: number) => {
    if (selectedAnswer !== null || !currentRoom?.riddles || !localPlayer) return;
    
    const currentRiddle = currentRoom.riddles[currentRoom.current_question];
    const correct = index === currentRiddle.correctIndex;
    
    setSelectedAnswer(index);
    setIsCorrect(correct);

    if (correct) {
      const newScore = localPlayer.score + 10;
      setLocalPlayer({ ...localPlayer, score: newScore });
      await supabase.from('players').update({ score: newScore }).eq('id', localPlayer.id);
    }
  };

  const nextQuestion = async () => {
    if (!currentRoom || !currentRoom.riddles) return;
    const isLast = currentRoom.current_question >= currentRoom.riddles.length - 1;
    if (isLast) {
      await supabase.from('rooms').update({ status: 'FINISHED' }).eq('id', currentRoom.id);
    } else {
      await supabase.from('rooms').update({ 
        current_question: currentRoom.current_question + 1 
      }).eq('id', currentRoom.id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl min-h-screen flex flex-col justify-center font-['Tajawal']">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black text-white mb-2 drop-shadow-xl tracking-tight">لغز الذكاء ✨</h1>
        <p className="text-indigo-200 text-lg">تحدَّ أصدقاءك في الوقت الفعلي</p>
      </div>

      <div className="bg-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-2xl border border-white/20 relative overflow-hidden">
        {gameState === 'PLAYING' && currentRoom?.riddles && (
          <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${((currentRoom.current_question + 1) / currentRoom.riddles.length) * 100}%` }}
            />
          </div>
        )}

        {gameState === 'START' && (
          <div className="space-y-6">
            <div className="grid gap-4">
              <Button onClick={createRoom} fullWidth size="lg" disabled={loading}>
                {loading ? 'جاري الإنشاء...' : 'أنشئ غرفة جديدة'}
              </Button>
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-4 text-indigo-300 text-sm">أو انضم برمز</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>
              <div className="flex gap-2">
                <input 
                  value={joinCode} 
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="رمز الغرفة" 
                  className="flex-1 bg-white/5 border border-white/20 rounded-2xl px-6 text-white text-center font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <Button onClick={joinRoom} variant="outline" disabled={loading}>انضمام</Button>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
               {(Object.values(Difficulty) as Difficulty[]).map((d) => (
                 <button
                   key={d}
                   onClick={() => setDifficulty(d)}
                   className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${difficulty === d ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-indigo-300 hover:bg-white/10'}`}
                 >
                   {d}
                 </button>
               ))}
            </div>
          </div>
        )}

        {gameState === 'LOADING' && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-indigo-200 animate-pulse text-xl">جاري استحضار الألغاز...</p>
          </div>
        )}

        {(gameState === 'LOBBY' || gameState === 'PLAYING' || gameState === 'FINISHED') && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-indigo-950/40 p-4 rounded-2xl border border-white/5">
              <div>
                <span className="text-indigo-300 text-xs block mb-1">رمز الدخول</span>
                <span className="text-white font-mono font-black text-xl tracking-widest">{currentRoom?.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  <p className="text-xs text-indigo-300">اللاعبون المتصلون</p>
                  <p className="text-white font-bold">{players.length}</p>
                </div>
                <div className="flex -space-x-3">
                  {players.slice(0, 4).map(p => (
                    <div key={p.id} className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-indigo-900 flex items-center justify-center text-xl shadow-lg ring-2 ring-white/10">
                      {p.avatar}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {gameState === 'LOBBY' && (
              <div className="text-center py-10 space-y-8">
                <div className="bg-white/5 p-6 rounded-3xl inline-block">
                  <h3 className="text-white text-2xl font-bold mb-2">انتظار اللاعبين...</h3>
                  <p className="text-indigo-200">شارك الكود مع أصدقائك</p>
                </div>
                {localPlayer?.avatar === '👑' ? (
                  <Button onClick={startNow} fullWidth size="lg">ابدأ اللعبة 🚀</Button>
                ) : (
                  <p className="text-indigo-400 animate-bounce">في انتظار المستضيف...</p>
                )}
              </div>
            )}

            {gameState === 'PLAYING' && currentRoom?.riddles && (
              <div className="space-y-6">
                <div className="text-center">
                  <span className="px-4 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-bold border border-indigo-500/30">
                    لغز {currentRoom.current_question + 1} من {currentRoom.riddles.length}
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-6 leading-relaxed">
                    {currentRoom.riddles[currentRoom.current_question].question}
                  </h2>
                </div>

                <div className="grid gap-3">
                  {currentRoom.riddles[currentRoom.current_question].options.map((opt, i) => {
                    const isThisSelected = selectedAnswer === i;
                    const isThisCorrect = i === currentRoom.riddles![currentRoom.current_question].correctIndex;
                    
                    let btnClass = "p-5 rounded-2xl border text-right transition-all text-lg font-medium ";
                    if (selectedAnswer === null) {
                      btnClass += "bg-white/5 border-white/10 hover:bg-white/20";
                    } else if (isThisCorrect) {
                      btnClass += "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold shadow-emerald-500/20 shadow-lg";
                    } else if (isThisSelected && !isThisCorrect) {
                      btnClass += "bg-rose-500/20 border-rose-500 text-rose-400";
                    } else {
                      btnClass += "bg-white/5 border-white/5 opacity-40";
                    }

                    return (
                      <button key={i} disabled={selectedAnswer !== null} onClick={() => handleAnswer(i)} className={btnClass}>
                        <div className="flex items-center justify-between">
                          <span>{opt}</span>
                          {selectedAnswer !== null && isThisCorrect && <span>✅</span>}
                          {selectedAnswer !== null && isThisSelected && !isThisCorrect && <span>❌</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedAnswer !== null && (
                  <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 text-center animate-in zoom-in-95">
                    <p className="text-indigo-200 text-sm mb-4">
                      {isCorrect ? 'أحسنت! (+10 نقاط)' : 'إجابة غير صحيحة.'}
                    </p>
                    <p className="text-white text-sm italic mb-4 opacity-80">"{currentRoom.riddles[currentRoom.current_question].explanation}"</p>
                    {localPlayer?.avatar === '👑' && (
                      <Button onClick={nextQuestion} fullWidth variant="secondary">السؤال التالي ➡️</Button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {gameState === 'FINISHED' && (
              <div className="text-center py-6 space-y-6">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-3xl font-black text-white">النتائج النهائية</h2>
                <div className="space-y-2">
                  {players.map((p, i) => (
                    <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border ${p.id === localPlayer?.id ? 'bg-indigo-600/30 border-indigo-500' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-indigo-300 w-4">{i + 1}</span>
                        <span className="text-2xl">{p.avatar}</span>
                        <span className="font-bold text-white">{p.name}</span>
                      </div>
                      <span className="bg-white/10 px-4 py-1 rounded-full font-mono text-indigo-200">{p.score}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={() => window.location.reload()} fullWidth variant="outline">العودة للرئيسية</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
