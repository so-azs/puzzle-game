
/**
 * خدمة إدارة الأصوات للعبة.
 * توفر وظائف لتشغيل المؤثرات الصوتية المختلفة.
 */

const SOUND_URLS = {
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  FAILURE: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  WIN: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  HINT: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'
};

class AudioService {
  private isMuted: boolean = false;
  private sounds: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    // التحميل المسبق للأصوات
    if (typeof window !== 'undefined') {
      Object.entries(SOUND_URLS).forEach(([key, url]) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.sounds.set(key, audio);
      });
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  play(soundKey: keyof typeof SOUND_URLS) {
    if (this.isMuted) return;
    
    const audio = this.sounds.get(soundKey);
    if (audio) {
      // إعادة الصوت للبداية إذا كان قيد التشغيل (للسماح بالتكرار السريع)
      audio.currentTime = 0;
      audio.play().catch(e => console.log('Audio play blocked by browser'));
    }
  }
}

export const audioService = new AudioService();
