// Username generator for new users
// Creates fun, memorable usernames like "CoolPanda123" or "HappyDolphin456"

const adjectives = [
  'Cool', 'Happy', 'Swift', 'Brave', 'Clever', 'Lucky', 'Sunny', 'Cosmic',
  'Epic', 'Zen', 'Wild', 'Mystic', 'Noble', 'Rapid', 'Silent', 'Vivid',
  'Jolly', 'Mighty', 'Smooth', 'Bright', 'Chill', 'Fresh', 'Golden', 'Royal',
  'Stellar', 'Turbo', 'Ultra', 'Wise', 'Zesty', 'Atomic', 'Cyber', 'Neon'
];

const nouns = [
  'Panda', 'Eagle', 'Tiger', 'Wolf', 'Fox', 'Bear', 'Lion', 'Hawk',
  'Shark', 'Dragon', 'Phoenix', 'Falcon', 'Raven', 'Viper', 'Cobra', 'Panther',
  'Dolphin', 'Wizard', 'Ninja', 'Knight', 'Ranger', 'Storm', 'Thunder', 'Flash',
  'Comet', 'Nova', 'Star', 'Moon', 'Wave', 'Fire', 'Ice', 'Shadow'
];

export const generateDefaultUsername = (): string => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  
  return `${adjective}${noun}${number}`;
};

export const generateMultipleUsernames = (count: number = 5): string[] => {
  const usernames = new Set<string>();
  
  while (usernames.size < count) {
    usernames.add(generateDefaultUsername());
  }
  
  return Array.from(usernames);
};

// Check if username is available
export const isUsernameAvailable = async (username: string, supabase: any): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .maybeSingle();
    
    return !data && !error;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
};

// Generate a unique username by trying multiple times
export const generateUniqueUsername = async (supabase: any, maxAttempts: number = 10): Promise<string | null> => {
  for (let i = 0; i < maxAttempts; i++) {
    const username = generateDefaultUsername();
    const available = await isUsernameAvailable(username, supabase);
    
    if (available) {
      return username;
    }
  }
  
  // If all attempts fail, add timestamp for uniqueness
  const timestamp = Date.now().toString().slice(-4);
  return `User${timestamp}`;
};