/**
 * Temporary MongoDB connection diagnostic.
 * Run from backend folder: node test-db.js
 * Delete when debugging is complete.
 */
const dns = require('dns');
const path = require('path');
const mongoose = require('mongoose');

// Load ONLY backend/.env — no dotenvx, explicit path
const dotenvResult = require('dotenv').config({
  path: path.join(__dirname, '.env'),
  override: true,
});

dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

function maskUri(uri) {
  if (!uri) return '(not set)';
  return uri.replace(/:([^@/]+)@/, ':****@');
}

function parseMongoUser(uri) {
  try {
    const match = uri.match(/^mongodb(\+srv)?:\/\/([^:]+):/);
    return match ? match[2] : '(unknown)';
  } catch {
    return '(parse error)';
  }
}

async function main() {
  console.log('--- MongoDB connection test ---\n');
  console.log('dotenv loaded:', dotenvResult.error ? `ERROR: ${dotenvResult.error.message}` : 'yes');
  console.log('dotenv path:', path.join(__dirname, '.env'));
  console.log('Parsed keys from .env:', Object.keys(dotenvResult.parsed || {}));

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('\nMONGODB_URI is missing. Set it in backend/.env');
    process.exit(1);
  }

  console.log('\nMONGODB_URI (masked):', maskUri(uri));
  console.log('Username from URI:', parseMongoUser(uri));
  console.log('URI length:', uri.length);
  console.log('Has leading/trailing spaces:', uri !== uri.trim());

  const cleanUri = uri.trim();

  try {
    console.log('\nConnecting (10s timeout)...');
    await mongoose.connect(cleanUri, { serverSelectionTimeoutMS: 10000 });
    console.log('SUCCESS: Connected to MongoDB');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    await mongoose.disconnect();
    console.log('Disconnected cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('\nFAILED:', err.message);

    if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
      console.error('\nAuthentication tips:');
      console.error('1. Atlas → Database Access → user must match URI username');
      console.error('2. Reset password in Atlas, then paste into backend/.env (one line, no quotes)');
      console.error('3. If password has special chars (@ # %), URL-encode them in the URI');
      console.error('4. Example format:');
      console.error(
        '   mongodb+srv://USERNAME:PASSWORD@cluster0.oaymsit.mongodb.net/?retryWrites=true&w=majority'
      );
    }
    if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED')) {
      console.error('\nDNS tip: Router may block SRV lookups. This script uses Google DNS (8.8.8.8).');
    }

    process.exit(1);
  }
}

main();
