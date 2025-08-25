// Environment loader helper
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local', override: true });

console.log('Environment variables loaded successfully');
