// server/utils/Logger.js
class Logger {
    static log(message) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${message}`);
    }
    
    static error(message) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ERROR: ${message}`);
    }
  }
  
  module.exports = Logger;