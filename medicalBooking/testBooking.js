import { testD4DriversBooking } from './d4BookingService.js';

const testBookingData = {
    location: 'London',
    bookingDate: '2024-03-20', // Example date
    bookingTime: '10:00',      // Example time
    firstName: 'John',
    lastName: 'Doe',
    email: 'test@example.com',
    phone: '07123456789',
    postalCode: 'IG1 4NH'
};

console.log('Starting D4Drivers booking test...');
testD4DriversBooking(testBookingData)
    .then(() => console.log('Booking test completed successfully'))
    .catch(error => console.error('Booking test failed:', error)); 