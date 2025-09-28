import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: String
}));

async function updateToAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const user = await User.findOne({ email: 'lifedada910@gmail.com' });
  if (user) {
    user.role = 'admin';
    await user.save();
    console.log('User updated to admin!');
  } else {
    console.log('User not found');
  }
  
  await mongoose.disconnect();
}

updateToAdmin();