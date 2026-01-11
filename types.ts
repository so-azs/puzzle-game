
export enum Difficulty {
  EASY = 'سهل',
  MEDIUM = 'متوسط',
  HARD = 'صعب'
}

export type GameMode = 'RIDDLES' | 'GUESS_WHO';

export type ThemeType = 'cosmic' | 'emerald' | 'sunset' | 'midnight' | 'ocean';

export interface ThemeConfig {
  id: ThemeType;
  name: string;
  bg: string;
  accent: string;
  preview: string;
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
  avatar: string;
}

export interface Room {
  id: string;
  code: string;
  status: GameState;
  current_question: number;
  difficulty: Difficulty;
  game_mode: GameMode;
  riddles?: Riddle[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
