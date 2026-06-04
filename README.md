# Local FTP Client side Web-app 
<img width="1365" height="734" alt="Screenshot 2026-06-04 7 30 17 PM" src="https://github.com/user-attachments/assets/3eb2236e-7b2c-4a86-8e1e-95e9b8947c8b" />

## 1. Prerequisites & Installation
To run this application, you need to have Node.js and npm installed on your system.

 ### 1. Install Node.js and npm
 If you don't have Node.js installed:
  - Windows/macOS: Download and run the installer from [Node.js](https://nodejs.org).

  - Linux (Debian/Ubuntu): Run the following commands in your terminal:
```
  sudo apt update
  sudo apt install nodejs npm
```

### 2. Set Up the Project
Clone or download this repository, navigate to the project folder, and initialize it:
```
  git clone https://github.com/doodle321/Local-FTP-client_Browser.git
  cd Local-FTP-client_Browser/
  npm init -y
```

### 3. Install Dependencies (Socket.io) 
Install basic-ftp and multer via npm:
```
npm install basic-ftp multer
```
## Running the Application
The main application logic is contained within the `ftp-client.js` file included in this repository.

### 1. Start the Server 

Run the application using Node.js:

```
node ftp-client.js
```
### 2. Access the Web App
Once the server is running, it will output the port number (e.g., Server running on port 3000).

On the host machine: Open your browser and go to http://localhost:3000

On other local devices: Find the host machine's local IP address (e.g., 192.168.1.10) and connect via `http://<host-ip>:3000`
