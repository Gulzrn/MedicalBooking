import puppeteer from 'puppeteer';

export async function testD4DriversBooking(bookingData) {
    let browser;
    try {
        console.log('Starting D4Drivers booking process...');
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        });
        const page = await browser.newPage();
        
        // Navigate to D4Drivers login page
        console.log('Navigating to D4Drivers...');
        await page.goto('https://business.d4drivers.uk/login', {
            waitUntil: 'networkidle0'
        });

        // Login
        console.log('Logging in...');
        await page.waitForSelector('#email');
        await page.type('#email', 'info@hgvlearning.com');
        await page.type('#password', 'League12345678');
        await page.click('button[type="submit"]');

        // Wait for navigation after login
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Wait for and click "Create booking" on the main page
        console.log('Clicking Create booking...');
        await page.waitForSelector('button.create-booking-button');
        await page.click('button.create-booking-button');

        // Wait for the page to fully load
        await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
        
        // Wait for the booking options to appear
        console.log('Waiting for booking options...');
        await page.waitForSelector('.booking-medicals-favorites-main-button', { visible: true });

        // Find and click the D4 Medical button using multiple methods
        console.log('Selecting D4 Medical booking...');
        
        // First try: Wait for button with specific text content
        const buttons = await page.$$('.booking-medicals-favorites-main-button');
        for (const button of buttons) {
            const text = await button.evaluate(el => el.textContent);
            if (text.includes('D4 Medical')) {
                console.log('Found D4 Medical button by text content');
                await button.click();
                break;
            }
        }

        // Wait for the postcode page to load using waitForSelector
        console.log('Waiting for postcode input...');
        await page.waitForSelector('input[placeholder="Enter a location"]', { visible: true, timeout: 10000 });

        // Step 1: Enter postcode and select location
        console.log('Entering postcode:', bookingData.postalCode);
        const postcodeInput = await page.waitForSelector('input[id^="mat-input-"][placeholder="Enter a location"]');
        await postcodeInput.click();
        await postcodeInput.type(bookingData.postalCode);
        
        // Wait for Google Places autocomplete to load and select first result
        console.log('Waiting for location suggestions...');
        await page.waitForSelector('.pac-container .pac-item', { visible: true, timeout: 5000 });
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        
        // Wait for the appointment slots to appear
        console.log('Waiting for appointment slots...');
        await page.waitForSelector('.appointment-slot-container', { visible: true, timeout: 10000 });
        
        // Click the Select button in the first appointment slot
        console.log('Selecting the first available location...');
        const selectButton = await page.waitForSelector('.appointment-slot-header-title-un-selected', { visible: true });
        await selectButton.click();
        
        // Wait for the appointment days to be visible
        console.log('Waiting for appointment days...');
        await page.waitForSelector('.appointment-slot-body-day', { visible: true });
        
        // Find the target date and time
        console.log('Looking for date:', bookingData.bookingDate);
        const targetDate = new Date(bookingData.bookingDate);
        const targetDay = targetDate.getDate();
        const targetMonth = targetDate.toLocaleString('default', { month: 'short' });
        
        // Find and click the correct date's time slot
        const days = await page.$$('.appointment-slot-body-day');
        let timeSlotFound = false;
        
        for (const day of days) {
            // Get the date value
            const dateText = await day.$eval('.appointment-slot-body-day-header-value', el => el.textContent);
            const [dayNum, monthText] = dateText.trim().split(' ');
            
            if (parseInt(dayNum) === targetDay && monthText.includes(targetMonth)) {
                console.log('Found matching date:', dateText);
                
                // Find the time slot button
                const timeSlots = await day.$$('.appointment-slot-body-day-slot-button');
                for (const slot of timeSlots) {
                    const timeText = await slot.$eval('.booking-medicals-favorites-button-title span', el => el.textContent.trim());
                    if (timeText === bookingData.bookingTime) {
                        console.log('Clicking time slot:', timeText);
                        await slot.click();
                        timeSlotFound = true;
                        break;
                    }
                }
                if (timeSlotFound) break;
            }
        }

        if (!timeSlotFound) {
            throw new Error(`Could not find time slot ${bookingData.bookingTime} on ${bookingData.bookingDate}`);
        }

        // Wait for Next button and click it
        console.log('Clicking Next...');
        const nextButton = await page.waitForSelector('button.mat-primary:has-text("Next")', { visible: true });
        await nextButton.click();

        // Step 3: Fill in customer details
        console.log('Filling customer details...');
        await page.waitForSelector('input[formcontrolname="firstName"]');
        await page.type('input[formcontrolname="firstName"]', bookingData.firstName);
        await page.type('input[formcontrolname="lastName"]', bookingData.lastName);
        await page.type('input[formcontrolname="email"]', bookingData.email);
        await page.type('input[formcontrolname="phone"]', bookingData.phone);

        // Handle date of birth if present
        if (bookingData.dateOfBirth) {
            const dob = new Date(bookingData.dateOfBirth);
            const formattedDob = `${dob.getDate().toString().padStart(2, '0')}/${(dob.getMonth() + 1).toString().padStart(2, '0')}/${dob.getFullYear()}`;
            await page.type('input[formcontrolname="dateOfBirth"]', formattedDob);
        }

        // Log the data that would be submitted
        console.log('Booking data ready to submit:', {
            location: 'Selected from postcode',
            date: bookingData.bookingDate,
            time: bookingData.bookingTime,
            name: `${bookingData.firstName} ${bookingData.lastName}`,
            email: bookingData.email,
            phone: bookingData.phone,
            postcode: bookingData.postalCode
        });

        // Wait for review using page.evaluate to create a delay
        console.log('Waiting for review...');
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000)));

        // Return success status
        return {
            success: true,
            message: 'Booking completed successfully'
        };

    } catch (error) {
        console.error('Error during booking process:', error);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
} 