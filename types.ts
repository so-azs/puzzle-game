
export enum Difficulty {
  EASY = 'سهل',
  MEDIUM = 'متوسط',
  HARD = 'صعب'
}

export interface Riddle {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type GameState = 'START' | 'LOBBY' | 'LOADING' | 'PLAYING' | 'FINISHED';

export interface Player {
  id: string;
  room_id: string;
  name: string;
  score: number;
  avatar: string; // مضافة للتميز البصري
}

export interface Room {
  id: string;
  code: string;
  status: GameState;
  current_question: number; // مطابقة لاسم العمود المطلوب
  difficulty: Difficulty;
  riddles?: Riddle[];
}
