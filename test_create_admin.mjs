// Simple admin user creation for testing
import bcrypt from 'bcryptjs';

async function createAdminUser() {
  console.log('Creating admin user for testing...');
  
  const adminData = {
    email: 'admin@odubo.studio',
    username: 'admin',
    password: await bcrypt.hash('admin123', 10),
    first_name: 'Admin',
    last_name: 'User',
    is_admin: 1
  };

  try {
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminData),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Admin user created successfully:', result);
    } else {
      console.log('❌ Failed to create admin user:', result);
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdminUser();
