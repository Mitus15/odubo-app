import { getUserByEmail } from './src/lib/db.js';

async function checkAdminStatus() {
  try {
    console.log('🔍 Checking admin status for maniodubo@gmail.com...');
    
    const user = await getUserByEmail('maniodubo@gmail.com');
    
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('✅ User found:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   is_admin:', user.is_admin);
    console.log('   role:', user.role || 'undefined');
    console.log('   created_at:', user.created_at);
    
    if (user.is_admin) {
      console.log('✅ User has admin privileges');
    } else {
      console.log('❌ User does NOT have admin privileges');
      console.log('   Need to set is_admin = 1 in database');
    }
    
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
  }
}

checkAdminStatus();
