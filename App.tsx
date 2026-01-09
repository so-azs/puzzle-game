
import React, { useState, useEffect, useRef } from 'react';
import { Difficulty, Riddle, GameState, Player, Room } from './types';
import { fetchRiddles } from './services/geminiService';
import { supabase } from './lib/supabase';
import Button from './components/Button';

const AVATARS = ['🦁', '🐯', '🦊', '🐨', '🐼', '🐸', '🤖', '👻'];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [joinCode, setJoinCode] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);

  // --- 1. جلب قائمة اللاعبين في غرفة معينة (REST API) ---
  const fetchPlayers = async (roomId: string) => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false });
    
    if (data) setPlayers(data);
    if (error) console.error("Error fetching players:", error);
  };

  // --- 2. التحديث اللحظي (Realtime) ---
  useEffect(() => {
    if (!currentRoom) return;

    // الاشتراك في قناة لمراقبة تحديثات جدول اللاعبين لهذه الغرفة فقط
    const channel = supabase
      .channel(`room-players-${currentRoom.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'players', 
          filter: `room_id=eq.${currentRoom.id}` 
        }, 
        (payload) => {
          // عند حدوث أي تغيير (تحديث نقاط مثلاً)، نقوم بجلب القائمة مجدداً
          fetchPlayers(currentRoom.id);
        }
      )
      .subscribe();

    // مراقبة تغيير حالة الغرفة (بدء اللعبة أو تغيير السؤال)
    const roomSub = supabase
      .channel(`room-state-${currentRoom.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoom.id}` },
        (payload) => {
          const updated = payload.new as Room;
          setCurrentRoom(updated);
          setGameState(updated.status);
          if (updated.status === 'PLAYING') {
            setIsAnswered(false);
            setTimeLeft(20);
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(roomSub);
    };
  }, [currentRoom?.id]);

  // --- 3. إضافة لاعب جديد (REST API) ---
  const joinRoom = async () => {
    // جلب الغرفة أولاً
    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', joinCode.toUpperCase())
      .single();

    if (!room) return alert('عذراً، رمز الغرفة غير صحيح');

    const playerName = prompt('أدخل اسمك المستعار:') || `لاعب ${Math.floor(Math.random() * 100)}`;
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    // إضافة اللاعب إلى جدول players
    const { data: newPlayer, error } = await supabase
      .from('players')
      .insert([{
        room_id: room.id,
        name: playerName,
        avatar: avatar,
        score: 0
      }])
      .select()
      .single();

    if (newPlayer) {
      setLocalPlayer(newPlayer);
      setCurrentRoom(room);
      setGameState(room.status);
      fetchPlayers(room.id);
    }
  };

  const createRoom = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: room } = await supabase
      .from('rooms')
      .insert([{ code, status: 'LOBBY', current_question: 0, difficulty }])
      .select()
      .single();

    if (room) {
      const { data: host } = await supabase
        .from('players')
        .insert([{ room_id: room.id, name: 'المستضيف', avatar: '👑', score: 0 }])
        .select()
        .single();
      
      if (host) {
        setLocalPlayer(host);
        setCurrentRoom(room);
        setGameState('LOBBY');
        fetchPlayers(room.id);
      }
    }
  };

  // --- 4. تحديث النقاط (REST API) ---
  const handleAnswer = async (index: number) => {
    if (isAnswered || !localPlayer || !currentRoom || !currentRoom.riddles) return;
    setIsAnswered(true);

    const isCorrect = index === currentRoom.riddles[currentRoom.current_question].correctIndex;
    
    if (isCorrect) {
      const bonus = Math.floor(timeLeft * 5);
      const newScore = localPlayer.score + 100 + bonus;

      const { data } = await supabase
        .from('players')
        .update({ score: newScore })
        .eq('id', localPlayer.id)
        .select()
        .single();

      if (data) setLocalPlayer(data);
    }
  };

  const nextQuestion = async () => {
    if (!currentRoom || !currentRoom.riddles) return;
    const isLast = currentRoom.current_question >= currentRoom.riddles.length - 1;

    await supabase
      .from('rooms')
      .update({ 
        current_question: isLast ? currentRoom.current_question : currentRoom.current_question + 1,
        status: isLast ? 'FINISHED' : 'PLAYING'
      })
      .eq('id', currentRoom.id);
  };

  const startNow = async () => {
    if (!currentRoom) return;
    const riddles = await fetchRiddles(difficulty);
    await supabase.from('rooms').update({ status: 'PLAYING', riddles }).eq('id', currentRoom.id);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl min-h-screen flex flex-col justify-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-white mb-2">تحدي الألغاز ⚡</h1>
        <p className="text-indigo-200">مدعوم بـ Supabase Realtime</p>
      </div>

      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20">
        {gameState === 'START' && (
          <div className="space-y-6">
            <Button onClick={createRoom} fullWidth size="lg">إنشاء غرفة</Button>
            <div className="flex gap-2">
              <input 
                value={joinCode} 
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="رمز الغرفة..." 
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 text-white"
              />
              <Button onClick={joinRoom} variant="outline">انضمام</Button>
            </div>
          </div>
        )}

        {(gameState === 'LOBBY' || gameState === 'PLAYING' || gameState === 'FINISHED') && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-indigo-900/40 p-3 rounded-2xl">
              <div className="text-white font-mono font-bold tracking-widest">{currentRoom?.code}</div>
              <div className="flex -space-x-2">
                {players.map(p => (
                  <div key={p.id} className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-indigo-900 flex items-center justify-center text-sm" title={p.name}>
                    {p.avatar}
                  </div>
                ))}
              </div>
            </div>

            {gameState === 'LOBBY' && (
              <div className="text-center py-10">
                <div className="animate-bounce text-4xl mb-4">⌛</div>
                <h3 className="text-white text-xl font-bold">في انتظار بدء التحدي...</h3>
                {localPlayer?.name === 'المستضيف' && (
                  <Button onClick={startNow} className="mt-6" size="lg" variant="secondary">ابدأ الآن للجميع</Button>
                )}
              </div>
            )}

            {gameState === 'PLAYING' && currentRoom?.riddles && (
              <div className="space-y-6">
                <div className="flex justify-between text-xs text-indigo-300 font-bold">
                  <span>السؤال {currentRoom.current_question + 1}</span>
                  <span>نقاطك الحالية: {localPlayer?.score}</span>
                </div>
                <h2 className="text-2xl font-bold text-white text-center leading-relaxed">
                  {currentRoom.riddles[currentRoom.current_question].question}
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {currentRoom.riddles[currentRoom.current_question].options.map((opt, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleAnswer(i)}
                      disabled={isAnswered}
                      className={`p-4 rounded-xl border-2 text-right transition-all ${
                        isAnswered ? 
                        (i === currentRoom.riddles![currentRoom.current_question].correctIndex ? 'bg-emerald-500/40 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-white/40') 
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {isAnswered && localPlayer?.name === 'المستضيف' && (
                  <Button onClick={nextQuestion} fullWidth variant="secondary">السؤال التالي</Button>
                )}
              </div>
            )}

            {gameState === 'FINISHED' && (
              <div className="space-y-6 text-center">
                <h2 className="text-3xl font-black text-white">الترتيب النهائي 🏆</h2>
                <div className="space-y-2">
                  {players.map((p, i) => (
                    <div key={p.id} className={`flex justify-between p-4 rounded-xl ${i === 0 ? 'bg-indigo-600' : 'bg-white/5'}`}>
                      <div className="text-white">#{i+1} {p.avatar} {p.name}</div>
                      <div className="text-white font-bold">{p.score}</div>
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
