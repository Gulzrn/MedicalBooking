import Imap from 'imap';
import jsforce from 'jsforce';
import { inspect } from 'util';
import { testD4DriversBooking } from './d4BookingService.js';
import dotenv from 'dotenv';
dotenv.config();
// Gmail IMAP configuration
const imapConfig = {
    user: process.env.EMAIL_ADDRESS,
    password: process.env.EMAIL_PASSWORD,
    host: process.env.IMAP_SERVER,
    port: parseInt(process.env.IMAP_PORT),
    tls: true,
    tlsOptions: {
        rejectUnauthorized: false
    },
    debug: console.log
};
console.log
('--------------->',imapConfig)
// Salesforce configuration
const sfConfig = {
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN,
    loginUrl: 'https://login.salesforce.com'
};
// const sfConfig = {
//     username: 'dre192@hotmail.co.uk',
//     // Combine password with security token
//     password: 'Dreman.com14Dreman.com14' + 'OfFvDUiEjxaW4m5vBsgQTYjMM',  // password + security token
//     loginUrl: 'https://login.salesforce.com'
// };

async function getSalesforceClient() {
    try {
        const conn = new jsforce.Connection({
            loginUrl: sfConfig.loginUrl,
            version: '58.0'
        });

        console.log('Attempting to connect to Salesforce...');
        await conn.login(sfConfig.username, sfConfig.password);
        console.log('Successfully connected to Salesforce');
        return conn;
    } catch (error) {
        console.error('Salesforce connection error:', error);
        throw error;
    }
}

async function getClientDetails(conn, contactId) {
    try {
        console.log('Fetching contact details for ID:', contactId);
        const metadata = await conn.sobject('Contact').describe();
        const allFields = metadata.fields.map(field => field.name);
        
        const contact = await conn.sobject('Contact')
            .select(allFields)
            .where({ Id: contactId })
            .execute();
            
        if (contact && contact.length > 0) {
            const contactData = contact[0];
            return {
                email: contactData.Email,
                dateOfBirth: contactData.Date_of_Birth__c,
                phone: contactData.Phone,
                firstName: contactData.FirstName,
                lastName: contactData.LastName,
                mailingAddress: {
                    street: contactData.MailingStreet,
                    city: contactData.MailingCity,
                    state: contactData.MailingState,
                    postalCode: contactData.MailingPostalCode,
                    country: contactData.MailingCountry
                }
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching Salesforce contact:', error);
        return null;
    }
}

function decodeQuotedPrintable(text) {
    return text
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractSalesforceUrl(body) {
    const decodedBody = decodeQuotedPrintable(body);
    const match = decodedBody.match(/(https:\/\/[a-zA-Z0-9.-]+\.force\.com\/lightning\/r\/Contact\/003[A-Za-z0-9]+\/view)/);
    if (match) {
        return match[1];
    }
    return null;
}

async function findBookingEmails(imap) {
    return new Promise((resolve, reject) => {
        console.log('Connecting to IMAP server...', {
            host: imapConfig.host,
            port: imapConfig.port,
            user: imapConfig.user
        });

        imap.once('ready', () => {
            console.log('IMAP connection ready');
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    console.error('Error opening inbox:', err);
                    reject(err);
                    return;
                }

                console.log('Opened inbox:', box.name);
                const searchCriteria = [['UNSEEN']];

                imap.search(searchCriteria, (err, results) => {
                    if (err) {
                        console.error('Error searching emails:', err);
                        reject(err);
                        return;
                    }

                    console.log('Found', results.length, 'unread emails');
                    const bookingEmails = [];

                    if (results.length === 0) {
                        imap.end();
                        resolve([]);
                        return;
                    }

                    const fetch = imap.fetch(results, {
                        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT', 'HEADER'],
                        struct: true
                    });

                    fetch.on('message', (msg) => {
                        console.log('Processing message...');
                        const emailData = {
                            headers: null,
                            body: '',
                            fullBody: '',
                            parsedData: {
                                firstName: '',
                                lastName: '',
                                salesforceUrl: '',
                                postalCode: '',
                                bookingDetails: '',
                                bookingTime: '',
                                bookingDate: '',
                                clientName: '',
                                salesforceDetails: null
                            }
                        };

                        msg.on('body', (stream, info) => {
                            let buffer = '';
                            stream.on('data', (chunk) => {
                                buffer += chunk.toString('utf8');
                            });
                            stream.once('end', () => {
                                if (info.which === 'TEXT') {
                                    emailData.body = buffer;
                                    emailData.fullBody = buffer;
                                } else if (info.which.startsWith('HEADER')) {
                                    emailData.headers = Imap.parseHeader(buffer);
                                }
                            });
                        });

                        msg.once('end', () => {
                            console.log('Finished processing message');
                            const bookingKeywords = ['book', 'booking', 'appointment', 'reservation'];
                            const hasBookingContent = bookingKeywords.some(keyword =>
                                emailData.body.toLowerCase().includes(keyword.toLowerCase()) ||
                                (emailData.headers.subject && emailData.headers.subject[0].toLowerCase().includes(keyword.toLowerCase()))
                            );

                            if (hasBookingContent) {
                                console.log('Found booking-related content');
                                // Extract Client Name using multiple patterns
                                const clientNameMatch = emailData.body.match(/Name:\s*([^\n]+)/i) || 
                                                      emailData.body.match(/Client:\s*([^\n]+)/i) ||
                                                      emailData.body.match(/Patient:\s*([^\n]+)/i);
                                
                                if (clientNameMatch) {
                                    const fullName = clientNameMatch[1].trim();
                                    const nameParts = fullName.split(/\s+/);
                                    emailData.parsedData.firstName = nameParts[0];
                                    emailData.parsedData.lastName = nameParts.slice(1).join(' ');
                                    emailData.parsedData.clientName = fullName;
                                }

                                // Extract Salesforce URL
                                const salesforceUrl = extractSalesforceUrl(emailData.fullBody);
                                if (salesforceUrl) {
                                    emailData.parsedData.salesforceUrl = salesforceUrl;
                                    const contactIdMatch = salesforceUrl.match(/Contact\/([^/]+)/);
                                    if (contactIdMatch) {
                                        emailData.parsedData.salesforceContactId = contactIdMatch[1];
                                    }
                                }

                                // Extract postal code
                                const postalCodeMatch = emailData.body.match(/[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}/i);
                                if (postalCodeMatch) {
                                    emailData.parsedData.postalCode = postalCodeMatch[0].toUpperCase();
                                }

                                // Extract booking details
                                const bookingDetailsMatch = emailData.body.match(/D4\s+Medical\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+(\d{2}:\d{2})/i);
                                if (bookingDetailsMatch) {
                                    emailData.parsedData.bookingDate = bookingDetailsMatch[1];
                                    emailData.parsedData.bookingTime = bookingDetailsMatch[2];
                                }

                                bookingEmails.push({
                                    headers: emailData.headers,
                                    parsedData: emailData.parsedData
                                });
                            }
                        });
                    });

                    fetch.once('error', (err) => {
                        console.error('Fetch error:', err);
                        reject(err);
                    });

                    fetch.once('end', () => {
                        console.log('Finished fetching all messages');
                        imap.end();
                        resolve(bookingEmails);
                    });
                });
            });
        });

        imap.once('error', (err) => {
            console.error('IMAP error:', err);
            reject(err);
        });

        imap.once('end', () => {
            console.log('IMAP connection ended');
        });

        imap.connect();
    });
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const imap = new Imap(imapConfig);

    try {
        console.log('Starting email search...');
        const emails = await findBookingEmails(imap);
        console.log(`Found ${emails.length} booking emails`);

        if (emails.length > 0) {
            try {
                const conn = await getSalesforceClient();
                console.log('Connected to Salesforce, fetching details...');
                
                for (let email of emails) {
                    if (email.parsedData.salesforceContactId) {
                        email.parsedData.salesforceDetails = await getClientDetails(conn, email.parsedData.salesforceContactId);
                        
                        try {
                            const [day, month, year] = email.parsedData.bookingDate.split(' ');
                            const monthNumber = new Date(`${month} 1, 2000`).getMonth() + 1;
                            const formattedDate = `${year}-${monthNumber.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

                            const bookingData = {
                                bookingDate: formattedDate,
                                bookingTime: email.parsedData.bookingTime,
                                firstName: email.parsedData.firstName,
                                lastName: email.parsedData.lastName,
                                email: email.parsedData.salesforceDetails?.email || 'info@hgvlearning.com',
                                phone: email.parsedData.salesforceDetails?.phone || '',
                                postalCode: email.parsedData.postalCode,
                                dateOfBirth: email.parsedData.salesforceDetails?.dateOfBirth
                            };

                            const bookingResult = await testD4DriversBooking(bookingData);
                            email.parsedData.bookingAttempted = true;
                            email.parsedData.bookingSuccess = bookingResult.success;
                            email.parsedData.bookingError = bookingResult.error;

                            if (bookingResult.success) {
                                console.log('Marking email as read...');
                                await new Promise((resolve, reject) => {
                                    imap.setFlags(email.headers.inbox.seq, '\\Seen', (err) => {
                                        if (err) {
                                            console.error('Error marking email as read:', err);
                                            reject(err);
                                        } else {
                                            console.log('Email marked as read successfully');
                                            resolve();
                                        }
                                    });
                                });
                            }
                        } catch (bookingError) {
                            console.error('Failed to book D4 appointment:', bookingError);
                            email.parsedData.bookingAttempted = true;
                            email.parsedData.bookingSuccess = false;
                            email.parsedData.bookingError = bookingError.message;
                        }
                    }
                }
            } catch (sfError) {
                console.error('Salesforce error:', sfError);
            }
        }
        
        return res.status(200).json({ success: true, emails });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
} 