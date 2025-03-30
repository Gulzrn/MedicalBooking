import React, { useState } from 'react';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);

  const checkBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3006/api/check-bookings');
      const data = await response.json();
      if (data.success) {
        setEmails(data.emails);
      } else {
        setError(data.error || 'Failed to fetch booking emails');
      }
    } catch (err) {
      setError('Error connecting to the server');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Medical Booking System</h1>
        <button 
          className="check-button" 
          onClick={checkBookings} 
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Check Booking Emails'}
        </button>
      </header>

      <main className="App-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {emails.length > 0 ? (
          <div className="emails-container">
            {emails.map((email, index) => (
              <div key={index} className="email-card">
                <h3>Booking Email {index + 1}</h3>
                <p><strong>Client:</strong> {email.parsedData.clientName}</p>
                <p><strong>Location:</strong> {email.parsedData.postalCode}</p>
                <p><strong>Booking Date:</strong> {email.parsedData.bookingDate}</p>
                <p><strong>Booking Time:</strong> {email.parsedData.bookingTime}</p>
                {email.parsedData.bookingAttempted && (
                  <div className={`booking-status ${email.parsedData.bookingSuccess ? 'success' : 'error'}`}>
                    {email.parsedData.bookingSuccess 
                      ? 'Booking Successful' 
                      : `Booking Failed: ${email.parsedData.bookingError}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No booking emails found.</p>
        )}
      </main>
    </div>
  );
}

export default App; 