import React, { useState, useEffect } from 'react';
import { Difficulty, Riddle, GameState, Player, Room } from './types.ts';
import { fetchRiddles } from './services/geminiService.ts';
import { supabase, isSupabaseConfigured } from './lib/supabase.ts';
import Button from './components/Button.tsx';

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

  // عرض واجهة خطأ إذا لم تكن الإعدادات موجودة
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">إعدادات ناقصة</h2>
          <p className="text-indigo-200 mb-6">يرجى إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في متغيرات البيئة بـ Netlify لتشغيل اللعبة.</p>
          <Button onClick={() => window.location.reload()}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  const fetchPlayers = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('score', { ascending: false });
      
      if (data) setPlayers(data);
      if (error) throw error;
    } catch (err) {
      console.error("Fetch players error:", err);
    }
  };

  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase
      .channel(`room-players-${currentRoom.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${currentRoom.id}` }, 
        () => fetchPlayers(currentRoom.id)
      )
      .subscribe();

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

  const joinRoom = async () => {
    if (!joinCode) return alert('أدخل رمز الغرفة');
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .single();

      if (error || !room) return alert('رمز الغرفة غير موجود');

      const name = prompt('اسمك:') || `لاعب ${Math.floor(Math.random()*100)}`;
      const { data: p, error: pe } = await supabase
        .from('players')
        .insert([{ room_id: room.id, name, avatar: AVATARS[0], score: 0 }])
        .select().single();

      if (p) {
        setLocalPlayer(p);
        setCurrentRoom(room);
        setGameState(room.status);
      }
    } catch (e) { alert('خطأ في الاتصال'); }
  };

  const createRoom = async () => {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: room, error } = await supabase
        .from('rooms')
        .insert([{ code, status: 'LOBBY', current_question: 0, difficulty }])
        .select().single();

      if (room) {
        const { data: h } = await supabase
          .from('players')
          .insert([{ room_id: room.id, name: 'المستضيف', avatar: '👑', score: 0 }])
          .select().single();
        if (h) {
          setLocalPlayer(h);
          setCurrentRoom(room);
          setGameState('LOBBY');
        }
      }
    } catch (e) { alert('تأكد من إعداد جداول قاعدة البيانات'); }
  };

  const startNow = async () => {
    if (!currentRoom) return;
    setGameState('LOADING');
    try {
      const riddles = await fetchRiddles(difficulty);
      await supabase.from('rooms').update({ status: 'PLAYING', riddles }).eq('id', currentRoom.id);
    } catch (e) { setGameState('LOBBY'); }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl min-h-screen flex flex-col justify-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-white mb-2 drop-shadow-md">تحدي الألغاز ⚡</h1>
        <p className="text-indigo-200">اختبر ذكاءك في الوقت الفعلي</p>
      </div>

      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20">
        {gameState === 'START' && (
          <div className="space-y-6">
            <Button onClick={createRoom} fullWidth size="lg">إنشاء غرفة جديدة</Button>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-indigo-300">أو انضم لصديق</span></div>
            <div className="flex gap-2">
              <input 
                value={joinCode} 
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="رمز الغرفة" 
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 text-white text-center uppercase"
              />
              <Button onClick={joinRoom} variant="outline">انضمام</Button>
            </div>
          </div>
        )}

        {gameState === 'LOADING' && (
          <div className="text-center py-20 animate-pulse text-indigo-200">جاري توليد الألغاز...</div>
        )}

        {(gameState === 'LOBBY' || gameState === 'PLAYING' || gameState === 'FINISHED') && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-indigo-900/40 p-3 rounded-2xl">
              <span className="text-white font-mono font-bold">كود: {currentRoom?.code}</span>
              <div className="flex -space-x-2">
                {players.map(p => <div key={p.id} className="w-8 h-8 rounded-full bg-indigo-600 border border-white flex items-center justify-center">{p.avatar}</div>)}
              </div>
            </div>

            {gameState === 'LOBBY' && (
              <div className="text-center py-10">
                <h3 className="text-white text-xl font-bold">في الانتظار...</h3>
                {localPlayer?.name === 'المستضيف' && <Button onClick={startNow} className="mt-8" fullWidth>ابدأ اللعب</Button>}
              </div>
            )}

            {gameState === 'PLAYING' && currentRoom?.riddles && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-center">{currentRoom.riddles[currentRoom.current_question].question}</h2>
                <div className="grid gap-2">
                  {currentRoom.riddles[currentRoom.current_question].options.map((opt, i) => (
                    <button key={i} className="p-4 bg-white/5 rounded-xl border border-white/10 text-right hover:bg-white/20">{opt}</button>
                  ))}
                </div>
              </div>
            )}
            
            {gameState === 'FINISHED' && <div className="text-center py-10 text-2xl font-bold">انتهت اللعبة! 🏆</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;