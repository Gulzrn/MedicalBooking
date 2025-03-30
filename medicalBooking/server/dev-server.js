import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import checkBookings from './api/check-bookings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Verify environment variables
const requiredEnvVars = [
  'EMAIL_ADDRESS',
  'EMAIL_PASSWORD',
  'IMAP_SERVER',
  'IMAP_PORT',
  'SF_USERNAME',
  'SF_PASSWORD',
  'SF_SECURITY_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// API endpoint
app.get('/api/check-bookings', checkBookings);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  });
});

app.listen(PORT, () => {
    console.log(`Development server running on port ${PORT}`);
    console.log('IMAP Configuration:', {
        server: process.env.IMAP_SERVER,
        port: process.env.IMAP_PORT,
        user: process.env.EMAIL_ADDRESS
    });
}); 